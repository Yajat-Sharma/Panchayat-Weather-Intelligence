"""
Turns coarse daily values into Panchayat-level downscaled values for every
variable the registry has a model for. One vectorised prediction per variable,
however many Panchayats and days are requested.
"""
from collections import Counter
from typing import Dict, List, Optional

import numpy as np

from ..inference import QUANTILES, VARIABLE_SPECS, ModelRegistry, lapse_rate_baseline
from .forecast_service import SOURCE_LABEL

VALIDATION_SCOPE = "historical_2023"
RAIN_EVENT_MM = 2.5


def _num(v) -> Optional[float]:
    if v is None:
        return None
    f = float(v)
    return round(f, 2) if np.isfinite(f) else None


def downscale(
    registry: ModelRegistry,
    rows: List[dict],
    block_input: bool = False,
) -> List[dict]:
    """
    rows: [{"feat": {...static features...}, "date": "YYYY-MM-DD",
            "coarse": {"rainfall": 3.1, "tmax": 31.2, ...}, "cell_elevation_m": 612.0}]
    Returns one dict per row: {variable: {coarse, baseline, correction, value, p10, p50, p90, prob?, ...}}
    """
    results: List[dict] = [{} for _ in rows]
    for var, spec in VARIABLE_SPECS.items():
        idx = [i for i, r in enumerate(rows) if r["coarse"].get(var) is not None]
        if not idx:
            continue
        coarse = [float(rows[i]["coarse"][var]) for i in idx]
        feats = [rows[i]["feat"] for i in idx]
        dates = [rows[i]["date"] for i in idx]
        cells = [rows[i].get("cell_elevation_m") for i in idx]

        model = registry.get(var)
        variant = "point_input"
        if model is not None and block_input:
            if model.block_model is not None:
                model, variant = model.block_model, "block_input"
            else:
                variant = "point_input_fallback"

        if model is not None:
            out = model.predict(coarse, feats, dates, cells)
            version = model.version
        else:
            # No trained model: physically-based baseline only (lapse rate for temperature).
            if spec["baseline"] == "lapse":
                pan = [float(f.get("elevation_mean") or np.nan) for f in feats]
                cell = [np.nan if c is None else float(c) for c in cells]
                base = lapse_rate_baseline(coarse, pan, cell)
            else:
                base = np.asarray(coarse, float)
            out = {"baseline": base, "correction": np.zeros(len(idx)), "value": base}
            version, variant = None, "baseline_only"

        for k, i in enumerate(idx):
            entry = {
                "coarse": _num(coarse[k]),
                "baseline": _num(out["baseline"][k]),
                "correction": _num(out["correction"][k]),
                "value": _num(out["value"][k]),
                "unit": spec["unit"],
                "downscaled": model is not None,
                "model_version": version,
                "model_variant": variant,
            }
            for q in QUANTILES:
                entry[q] = _num(out[q][k]) if q in out else None
            if var == "rainfall":
                if "prob" in out:
                    entry["prob"] = _num(out["prob"][k])
                    entry["prob_source"] = "classifier"
                else:
                    entry["prob"] = None
                    entry["prob_source"] = None
            results[i][var] = entry
    return results


def forecast_days(registry: ModelRegistry, gpcode: str, feat: dict, coarse_fc: dict) -> List[dict]:
    """Downscaled operational forecast for one Panchayat in the multi-variable schema."""
    rows = [
        {"feat": feat, "date": d["date"], "coarse": {v: d.get(v) for v in VARIABLE_SPECS},
         "cell_elevation_m": coarse_fc.get("cell_elevation_m")}
        for d in coarse_fc["days"]
    ]
    out = downscale(registry, rows)
    days = []
    for row, vals in zip(rows, out):
        day = {"gpcode": gpcode, "date": row["date"], **vals}
        rain = vals.get("rainfall")
        if rain:
            # Legacy flat fields — kept for one release while the UI migrates.
            day["era5_baseline_input_mm"] = rain["coarse"]
            day["model_residual_correction_mm"] = rain["correction"]
            day["final_downscaled_prediction_mm"] = rain["value"]
            day["model_version"] = rain["model_version"]
        day["prediction_type"] = "live_operational_forecast"
        day["operational_source"] = SOURCE_LABEL
        days.append(day)
    return days


def area_weighted_mean(values: List[Optional[float]], weights: List[float]) -> Optional[float]:
    pairs = [(v, w if w and w > 0 else 1.0) for v, w in zip(values, weights) if v is not None]
    if not pairs:
        return None
    tot = sum(w for _, w in pairs)
    return sum(v * w for v, w in pairs) / tot


def block_members(features_dict: Dict[str, dict], block: str) -> Dict[str, dict]:
    key = block.strip().lower()
    return {gp: f for gp, f in features_dict.items() if str(f.get("blkname", "")).strip().lower() == key}


def canonical_block_name(members: Dict[str, dict]) -> str:
    return Counter(str(f.get("blkname", "")).strip() for f in members.values()).most_common(1)[0][0]


def list_blocks(features_dict: Dict[str, dict]) -> List[dict]:
    """Blocks grouped case-insensitively (the source mixes 'HAVELI' and 'Haveli'); shows the commonest spelling."""
    blocks: Dict[str, dict] = {}
    for f in features_dict.values():
        name = str(f.get("blkname") or "").strip()
        if not name:
            continue
        b = blocks.setdefault(name.lower(), {"spellings": Counter(), "district": f.get("dtname"),
                                             "panchayat_count": 0, "area_sqkm": 0.0})
        b["spellings"][name] += 1
        b["panchayat_count"] += 1
        b["area_sqkm"] += float(f.get("area_sqkm") or 0.0)
    out = [{"block": b["spellings"].most_common(1)[0][0], "district": b["district"],
            "panchayat_count": b["panchayat_count"], "area_sqkm": round(b["area_sqkm"], 1)} for b in blocks.values()]
    return sorted(out, key=lambda b: b["block"].lower())


def spread(values: List[Optional[float]]) -> Optional[dict]:
    arr = np.array([v for v in values if v is not None], float)
    if arr.size == 0:
        return None
    return {"min": _num(arr.min()), "max": _num(arr.max()), "mean": _num(arr.mean()), "std": _num(arr.std())}


def downscale_block(
    registry: ModelRegistry,
    members: Dict[str, dict],
    block_days: List[dict],
    block_cell_elevation: Optional[float],
) -> dict:
    """
    block_days: [{"date": ..., "rainfall": x, "tmax": y, ...}] — one block-level value per variable per day.
    Returns per-day block values, per-Panchayat downscaled values and within-block spread.
    """
    gps = list(members)
    rows = []
    for d in block_days:
        for gp in gps:
            rows.append({"feat": members[gp], "date": d["date"],
                         "coarse": {v: d.get(v) for v in VARIABLE_SPECS},
                         "cell_elevation_m": block_cell_elevation})
    out = downscale(registry, rows, block_input=True)

    days = []
    n = len(gps)
    for di, d in enumerate(block_days):
        chunk = out[di * n:(di + 1) * n]
        pan = [{"gpcode": gp, "name": members[gp].get("GPNAME"), **vals} for gp, vals in zip(gps, chunk)]
        days.append({
            "date": d["date"],
            "block_value": {v: _num(d.get(v)) for v in VARIABLE_SPECS},
            "spread": {v: spread([p.get(v, {}).get("value") for p in pan]) for v in VARIABLE_SPECS},
            "panchayats": pan,
        })
    return {"days": days}
