"""
Multi-variable downscaling inference.

Each variable (rainfall, tmax, tmin, rh, wind) has its own residual XGBoost
model trained by ``ml/scripts/deploy_model.py``:

    final = clip(baseline + XGBoost(features))

where ``baseline`` is the coarse value, or for temperature the coarse value
corrected by a standard lapse rate for the difference between the Panchayat's
mean elevation and the coarse grid cell's elevation.

Optional companions, loaded when present:
  * quantile models (p10 / p50 / p90 of the residual) -> uncertainty band
  * a rain-occurrence classifier                      -> P(rain > 2.5 mm)
  * a block-input model variant                       -> block -> Panchayat mapping
"""
import json
import os
from datetime import datetime
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
import xgboost as xgb

LAPSE_RATE_C_PER_M = -0.0065
QUANTILES = ("p10", "p50", "p90")

# Variable registry. `coarse_feature` is the name of the coarse input column the
# model was trained with; `clip` bounds the output to a physically possible range.
VARIABLE_SPECS: Dict[str, dict] = {
    "rainfall": {"coarse_feature": "era5_rainfall_mm", "clip": (0.0, None), "baseline": "coarse", "unit": "mm"},
    "tmax": {"coarse_feature": "era5_tmax_c", "clip": (None, None), "baseline": "lapse", "unit": "°C"},
    "tmin": {"coarse_feature": "era5_tmin_c", "clip": (None, None), "baseline": "lapse", "unit": "°C"},
    "rh": {"coarse_feature": "era5_rh_pct", "clip": (0.0, 100.0), "baseline": "coarse", "unit": "%"},
    "wind": {"coarse_feature": "era5_wind_kmh", "clip": (0.0, None), "baseline": "coarse", "unit": "km/h"},
}

LEGACY_RAINFALL_FEATURES = [
    "era5_rainfall_mm",
    "elevation_min", "elevation_max", "elevation_mean", "elevation_std",
    "elevation_p10", "elevation_p50", "elevation_p90",
    "area_sqkm", "centroid_lat", "centroid_lon",
    "day_of_year", "month",
]


def lapse_rate_baseline(coarse: np.ndarray, panchayat_elev: np.ndarray, cell_elev: np.ndarray) -> np.ndarray:
    """Coarse temperature adjusted to the Panchayat's elevation (6.5 °C/km)."""
    diff = np.nan_to_num(np.asarray(panchayat_elev, float) - np.asarray(cell_elev, float), nan=0.0)
    return np.asarray(coarse, float) + LAPSE_RATE_C_PER_M * diff


def _clip(values: np.ndarray, bounds) -> np.ndarray:
    lo, hi = bounds
    return np.clip(values, lo, hi) if (lo is not None or hi is not None) else values


def _parse_date(date_str: str):
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    return dt.timetuple().tm_yday, dt.month


def _load_booster(path: str, cls=xgb.XGBRegressor):
    m = cls()
    m.load_model(path)
    return m


def build_feature_frame(
    feature_order: List[str],
    coarse_feature: str,
    coarse_values: List[float],
    panchayat_features: List[dict],
    dates: List[str],
    cell_elevations: Optional[List[Optional[float]]] = None,
) -> pd.DataFrame:
    """One row per (Panchayat, day). Static columns come straight from the feature table."""
    n = len(coarse_values)
    cell_elevations = cell_elevations or [None] * n
    rows = []
    for coarse, feat, date, cell_elev in zip(coarse_values, panchayat_features, dates, cell_elevations):
        doy, month = _parse_date(date)
        pan_elev = float(feat.get("elevation_mean") or 0.0)
        cell = pan_elev if cell_elev is None or pd.isna(cell_elev) else float(cell_elev)
        row = {}
        for col in feature_order:
            if col == coarse_feature:
                row[col] = float(coarse)
            elif col == "day_of_year":
                row[col] = float(doy)
            elif col == "month":
                row[col] = float(month)
            elif col == "cell_elevation_m":
                row[col] = cell
            elif col == "elev_diff_m":
                row[col] = pan_elev - cell
            else:
                v = feat.get(col)
                row[col] = 0.0 if v is None or pd.isna(v) else float(v)
        rows.append(row)
    return pd.DataFrame(rows, columns=feature_order)


class VariableModel:
    """Point model plus optional quantile / probability / block-input companions for one variable."""

    def __init__(self, variable: str, point_path: str, metadata: dict, model_dir: Optional[str] = None):
        self.variable = variable
        self.spec = VARIABLE_SPECS[variable]
        self.metadata = metadata
        self.feature_order = metadata.get("feature_order") or LEGACY_RAINFALL_FEATURES
        self.version = metadata.get("model_version", "unknown")
        self.point = _load_booster(point_path)
        self.quantiles: Dict[str, xgb.XGBRegressor] = {}
        self.rain_classifier = None
        self.block_model: Optional["VariableModel"] = None
        if model_dir:
            for q in QUANTILES:
                p = os.path.join(model_dir, f"{q}.json")
                if os.path.exists(p):
                    self.quantiles[q] = _load_booster(p)
            if len(self.quantiles) != len(QUANTILES):
                self.quantiles = {}
            cls_path = os.path.join(model_dir, "rain_probability.json")
            if variable == "rainfall" and os.path.exists(cls_path):
                self.rain_classifier = _load_booster(cls_path, xgb.XGBClassifier)

    def baseline(self, coarse, panchayat_features, cell_elevations) -> np.ndarray:
        coarse = np.asarray(coarse, float)
        if self.spec["baseline"] != "lapse":
            return coarse
        pan = [float(f.get("elevation_mean") or np.nan) for f in panchayat_features]
        cell = [np.nan if c is None else float(c) for c in (cell_elevations or [None] * len(coarse))]
        return lapse_rate_baseline(coarse, pan, cell)

    def predict(self, coarse_values, panchayat_features, dates, cell_elevations=None) -> Dict[str, np.ndarray]:
        X = build_feature_frame(
            self.feature_order, self.spec["coarse_feature"], coarse_values, panchayat_features, dates, cell_elevations
        )
        base = self.baseline(coarse_values, panchayat_features, cell_elevations)
        correction = self.point.predict(X).astype(float)
        out = {
            "baseline": base,
            "correction": correction,
            "value": _clip(base + correction, self.spec["clip"]),
        }
        if self.quantiles:
            qs = np.stack([_clip(base + self.quantiles[q].predict(X), self.spec["clip"]) for q in QUANTILES])
            qs = np.sort(qs, axis=0)  # enforce p10 <= p50 <= p90 (quantile crossing)
            for i, q in enumerate(QUANTILES):
                out[q] = qs[i]
        if self.rain_classifier is not None:
            out["prob"] = self.rain_classifier.predict_proba(X)[:, 1].astype(float)
        return out


class ModelRegistry:
    """
    Loads every variable found under ``models_dir``:

        models_dir/<variable>/model.json + metadata.json (+ p10/p50/p90.json, rain_probability.json)
        models_dir/<variable>_block/...  (block-input variant)

    For backward compatibility, rainfall falls back to ``xgboost_downscaler.json`` (v1).
    """

    def __init__(self, models_dir: str):
        self.models_dir = models_dir
        self.models: Dict[str, VariableModel] = {}
        self.errors: Dict[str, str] = {}
        for var in VARIABLE_SPECS:
            m = self._load_dir(var, os.path.join(models_dir, var))
            if m is None and var == "rainfall":
                m = self._load_legacy_rainfall()
            if m is None:
                continue
            m.block_model = self._load_dir(var, os.path.join(models_dir, f"{var}_block"))
            self.models[var] = m
        self.metrics = self._load_json(os.path.join(models_dir, "metrics.json")) or {}

    @staticmethod
    def _load_json(path):
        if os.path.exists(path):
            with open(path) as f:
                return json.load(f)
        return None

    def _load_dir(self, var, d) -> Optional[VariableModel]:
        point = os.path.join(d, "model.json")
        if not os.path.exists(point):
            return None
        try:
            return VariableModel(var, point, self._load_json(os.path.join(d, "metadata.json")) or {}, d)
        except Exception as e:  # a broken model shouldn't take the API down
            self.errors[os.path.basename(d)] = str(e)
            return None

    def _load_legacy_rainfall(self) -> Optional[VariableModel]:
        path = os.path.join(self.models_dir, "xgboost_downscaler.json")
        if not os.path.exists(path):
            return None
        meta = self._load_json(path.replace(".json", "_metadata.json")) or {}
        return VariableModel("rainfall", path, meta)

    @property
    def loaded(self) -> bool:
        return "rainfall" in self.models

    def get(self, var: str) -> Optional[VariableModel]:
        return self.models.get(var)


class WeatherDownscaler:
    """Rainfall-only facade kept for the legacy single/batch endpoints."""

    def __init__(self, model_path: str, registry: Optional[ModelRegistry] = None):
        self.registry = registry or ModelRegistry(os.path.dirname(model_path))
        self.model_obj = self.registry.get("rainfall")
        self.loaded = self.model_obj is not None
        self.metadata = self.model_obj.metadata if self.loaded else {}
        self.features_order = self.model_obj.feature_order if self.loaded else LEGACY_RAINFALL_FEATURES

    @staticmethod
    def _validate_rainfall(rainfall: float):
        if rainfall is None or pd.isna(rainfall):
            raise ValueError("ERA5 rainfall input cannot be missing (NaN).")
        if not np.isfinite(rainfall):
            raise ValueError("ERA5 rainfall input cannot be infinite.")
        if rainfall < 0:
            raise ValueError("ERA5 rainfall input cannot be negative.")

    def predict(self, gpcode: str, date_str: str, era5_rainfall: float, panchayat_features: dict) -> tuple[float, float, str]:
        """Returns (final_prediction, residual, model_version)."""
        if not self.loaded:
            raise RuntimeError("Model is not loaded.")
        self._validate_rainfall(era5_rainfall)
        _parse_date(date_str)
        out = self.model_obj.predict([float(era5_rainfall)], [panchayat_features], [date_str])
        return float(out["value"][0]), float(out["correction"][0]), self.model_obj.version

    def batch_predict(self, inputs_list: list[dict], features_dict: dict) -> list[dict]:
        """inputs_list: [{"gpcode": "123", "date": "2023-01-01", "era5_rainfall_mm": 5.5}]"""
        if not self.loaded:
            raise RuntimeError("Model is not loaded.")
        results: list = [None] * len(inputs_list)
        ok_idx, coarse, feats, dates = [], [], [], []
        for i, item in enumerate(inputs_list):
            try:
                gpcode = str(item["gpcode"])
                if gpcode not in features_dict:
                    raise ValueError(f"GPCODE {gpcode} not found.")
                rain = float(item["era5_rainfall_mm"])
                self._validate_rainfall(rain)
                _parse_date(item["date"])
                ok_idx.append(i)
                coarse.append(rain)
                feats.append(features_dict[gpcode])
                dates.append(item["date"])
            except Exception as e:
                results[i] = {"gpcode": item.get("gpcode"), "date": item.get("date"), "error": str(e)}
        if ok_idx:
            out = self.model_obj.predict(coarse, feats, dates)
            for k, i in enumerate(ok_idx):
                results[i] = {
                    "gpcode": inputs_list[i]["gpcode"],
                    "date": inputs_list[i]["date"],
                    "era5_baseline_input_mm": coarse[k],
                    "model_residual_correction_mm": float(out["correction"][k]),
                    "final_downscaled_prediction_mm": float(out["value"][k]),
                    "model_version": self.model_obj.version,
                    "prediction_type": "historical_experimental_inference",
                }
        return results
