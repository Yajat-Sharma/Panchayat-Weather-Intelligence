"""
Residual XGBoost training and spatial-block cross-validation, shared by every variable.

    target = baseline + residual,   model learns residual
    baseline = coarse value (rain, RH, wind) or lapse-rate-adjusted coarse value (Tmax, Tmin)

Input modes:
    point : coarse value at the Panchayat centroid's ERA5 cell
    block : area-weighted mean of ERA5 over the Panchayat's block (block -> Panchayat mapping)
"""
from typing import Dict, Tuple

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.cluster import KMeans
from sklearn.metrics import brier_score_loss, roc_auc_score

from .config import N_FOLDS, QUANTILES, RAIN_EVENT_MM, SEED, VARIABLES, XGB_PARAMS, feature_list
from .physics import lapse_rate_baseline


def assign_spatial_folds(df: pd.DataFrame, k: int = N_FOLDS) -> pd.Series:
    """K-Means on Panchayat centroids -> contiguous geographic folds (same scheme as v1)."""
    gps = df[["GPCODE", "centroid_lat", "centroid_lon"]].drop_duplicates("GPCODE")
    km = KMeans(n_clusters=k, random_state=SEED, n_init=10)
    gps = gps.assign(fold_id=km.fit_predict(gps[["centroid_lat", "centroid_lon"]]))
    return df["GPCODE"].map(dict(zip(gps["GPCODE"], gps["fold_id"])))


def model_frame(df: pd.DataFrame, var: str, feature_set: str = "v1", mode: str = "point") -> Tuple[pd.DataFrame, np.ndarray]:
    """
    Feature matrix and baseline for one variable. In block mode the coarse column and the
    cell elevation are replaced by their block means, keeping the same column names so the
    deployed model is fed exactly like the point model.
    """
    spec = VARIABLES[var]
    cols = feature_list(var, feature_set)
    X = df.reindex(columns=cols).copy()
    coarse = df[spec["coarse"]].to_numpy(float)
    cell = df["cell_elevation_m"].to_numpy(float) if "cell_elevation_m" in df else np.full(len(df), np.nan)
    if mode == "block":
        coarse = df[f"block_{spec['coarse']}"].to_numpy(float)
        cell = df["block_cell_elevation_m"].to_numpy(float)
        X[spec["coarse"]] = coarse
    if "cell_elevation_m" in X:
        X["cell_elevation_m"] = cell
    if "elev_diff_m" in X:
        X["elev_diff_m"] = df["elevation_mean"].to_numpy(float) - cell
    if spec["baseline"] == "lapse":
        base = lapse_rate_baseline(coarse, df["elevation_mean"].to_numpy(float), cell)
    else:
        base = coarse
    return X, base


def clip(values, var):
    lo, hi = VARIABLES[var]["clip"]
    return np.clip(values, lo, hi) if (lo is not None or hi is not None) else values


def fit_regressor(X, y, **overrides) -> xgb.XGBRegressor:
    m = xgb.XGBRegressor(**{**XGB_PARAMS, **overrides})
    m.fit(X, y)
    return m


def fit_quantile(X, y, alpha: float) -> xgb.XGBRegressor:
    return fit_regressor(X, y, objective="reg:quantileerror", quantile_alpha=alpha)


def fit_rain_classifier(X, y_event) -> xgb.XGBClassifier:
    m = xgb.XGBClassifier(**{**XGB_PARAMS, "objective": "binary:logistic", "eval_metric": "logloss"})
    m.fit(X, y_event)
    return m


def _err(y, p) -> Dict[str, float]:
    d = np.asarray(p, float) - np.asarray(y, float)
    return {"rmse": float(np.sqrt(np.mean(d ** 2))), "mae": float(np.mean(np.abs(d)))}


def compare(y, base, pred) -> Dict[str, float]:
    b, m = _err(y, base), _err(y, pred)
    return {
        "baseline_rmse": round(b["rmse"], 4), "model_rmse": round(m["rmse"], 4),
        "baseline_mae": round(b["mae"], 4), "model_mae": round(m["mae"], 4),
        "rmse_reduction_percent": round((b["rmse"] - m["rmse"]) / b["rmse"] * 100, 2) if b["rmse"] else 0.0,
        "mae_reduction_percent": round((b["mae"] - m["mae"]) / b["mae"] * 100, 2) if b["mae"] else 0.0,
    }


def interval_stats(y, lo, hi, nominal=0.8) -> Dict[str, float]:
    y, lo, hi = (np.asarray(a, float) for a in (y, lo, hi))
    return {"nominal": nominal, "coverage": round(float(np.mean((y >= lo) & (y <= hi))), 4),
            "mean_width": round(float(np.mean(hi - lo)), 4)}


def order_quantiles(q: Dict[str, np.ndarray]) -> Dict[str, np.ndarray]:
    """Sort per row so p10 <= p50 <= p90 even when independently trained models cross."""
    names = list(QUANTILES)
    stacked = np.sort(np.stack([q[n] for n in names]), axis=0)
    return {n: stacked[i] for i, n in enumerate(names)}


def cross_validate(
    df: pd.DataFrame,
    var: str,
    feature_set: str = "v1",
    mode: str = "point",
    uncertainty: bool = False,
) -> Tuple[dict, pd.DataFrame]:
    """Spatial-block CV. Returns (metrics, out-of-fold predictions)."""
    spec = VARIABLES[var]
    df = df.dropna(subset=[spec["coarse"], spec["target"]]).reset_index(drop=True)
    if mode == "block":
        df = df.dropna(subset=[f"block_{spec['coarse']}"]).reset_index(drop=True)
    folds = assign_spatial_folds(df)
    X, base = model_frame(df, var, feature_set, mode)
    y = df[spec["target"]].to_numpy(float)
    resid = y - base

    pred = np.full(len(df), np.nan)
    q = {n: np.full(len(df), np.nan) for n in QUANTILES}
    prob = np.full(len(df), np.nan)
    fold_metrics = {}
    for k in sorted(folds.dropna().unique()):
        tr, te = (folds != k).to_numpy(), (folds == k).to_numpy()
        m = fit_regressor(X[tr], resid[tr])
        pred[te] = clip(base[te] + m.predict(X[te]), var)
        if uncertainty:
            for n, alpha in QUANTILES.items():
                q[n][te] = clip(base[te] + fit_quantile(X[tr], resid[tr], alpha).predict(X[te]), var)
            if var == "rainfall":
                prob[te] = fit_rain_classifier(X[tr], (y[tr] > RAIN_EVENT_MM).astype(int)).predict_proba(X[te])[:, 1]
        fold_metrics[f"fold_{int(k)}"] = {
            "test_panchayats": int(df.loc[te, "GPCODE"].nunique()),
            **compare(y[te], base[te], pred[te]),
        }

    metrics = {
        "feature_set": feature_set,
        "mode": mode,
        "panchayats": int(df["GPCODE"].nunique()),
        "rows": int(len(df)),
        "point": {**compare(y, base, pred), "folds": fold_metrics},
    }
    oof = df[["GPCODE", "date"]].copy()
    oof["fold_id"] = folds.to_numpy()
    oof["coarse"] = df[spec["coarse"]] if mode == "point" else df[f"block_{spec['coarse']}"]
    oof["baseline"], oof["target"], oof["downscaled"] = base, y, pred

    if uncertainty:
        q = order_quantiles(q)
        for n in QUANTILES:
            oof[n] = q[n]
        metrics["interval"] = interval_stats(y, q["p10"], q["p90"])
        if var == "rainfall":
            event = (y > RAIN_EVENT_MM).astype(int)
            clim = np.full(len(y), event.mean())
            metrics["rain_probability"] = {
                "threshold_mm": RAIN_EVENT_MM,
                "brier": round(float(brier_score_loss(event, prob)), 4),
                "brier_climatology": round(float(brier_score_loss(event, clim)), 4),
                "auc": round(float(roc_auc_score(event, prob)), 4) if 0 < event.mean() < 1 else None,
            }
            oof["rain_probability"] = prob
    if var == "rainfall":
        heavy = y > 50
        metrics["heavy_rainfall"] = {"sample_count": int(heavy.sum()),
                                     **({"baseline_rmse": round(_err(y[heavy], base[heavy])["rmse"], 4),
                                         "model_rmse": round(_err(y[heavy], pred[heavy])["rmse"], 4)} if heavy.any() else {})}
    return metrics, oof


def fit_all(df: pd.DataFrame, var: str, feature_set: str, mode: str = "point") -> dict:
    """Production models on all data: point, quantiles and (rain only) the occurrence classifier."""
    spec = VARIABLES[var]
    needed = [spec["coarse"], spec["target"]] + ([f"block_{spec['coarse']}"] if mode == "block" else [])
    df = df.dropna(subset=needed).reset_index(drop=True)
    X, base = model_frame(df, var, feature_set, mode)
    y = df[spec["target"]].to_numpy(float)
    resid = y - base
    models = {"model": fit_regressor(X, resid)}
    for n, alpha in QUANTILES.items():
        models[n] = fit_quantile(X, resid, alpha)
    if var == "rainfall" and mode == "point":
        models["rain_probability"] = fit_rain_classifier(X, (y > RAIN_EVENT_MM).astype(int))
    return {"models": models, "feature_order": list(X.columns), "rows": len(df)}
