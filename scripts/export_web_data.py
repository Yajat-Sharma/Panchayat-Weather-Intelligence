"""
Export the API's data and models into apps/web so the Next.js app can serve the
whole API itself (Next.js route handlers, e.g. on Netlify) with no Python backend.

Writes:
  apps/web/data/features.json              gpcode -> static Panchayat features
  apps/web/data/models.json                every trained variable's boosters in a compact tree form, plus metrics
  apps/web/public/data/panchayats.geojson  boundaries (trimmed properties, 5-decimal coordinates)

Re-run after retraining or changing the boundary / feature files:

    cd apps/api && uv run python ../../scripts/export_web_data.py
"""
import json
import math
import os
import sys

import pandas as pd

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA = os.environ.get("PWI_DATA_DIR", os.path.join(ROOT, "data"))
MODELS_DIR = os.environ.get("PWI_MODELS_DIR", os.path.join(DATA, "models"))
GEOJSON_PATH = os.path.join(DATA, "interim", "boundaries", "pune_panchayats_valid.geojson")
PARQUET_PATH = os.path.join(DATA, "processed", "features", "panchayat_static_features.parquet")
WEB = os.path.join(ROOT, "apps", "web")

VARIABLES = ("rainfall", "tmax", "tmin", "rh", "wind")
QUANTILES = ("p10", "p50", "p90")
GEO_PROPS = ("GPCODE", "GPNAME", "blkname", "dtname", "area_sqkm")
LEGACY_RAINFALL_FEATURES = [
    "era5_rainfall_mm",
    "elevation_min", "elevation_max", "elevation_mean", "elevation_std",
    "elevation_p10", "elevation_p50", "elevation_p90",
    "area_sqkm", "centroid_lat", "centroid_lon",
    "day_of_year", "month",
]


def gp_key(val):
    if val is None or pd.isna(val) or str(val).strip() == "":
        return None
    try:
        return str(int(float(val)))
    except ValueError:
        return None


def clean(v):
    if v is None:
        return None
    if isinstance(v, float) or hasattr(v, "item"):
        v = v.item() if hasattr(v, "item") else v
        if isinstance(v, float) and not math.isfinite(v):
            return None
    return v


def load_json(path):
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return None


# ---- models -------------------------------------------------------------------

def parse_base_score(raw) -> float:
    s = str(raw).strip()
    if s.startswith("["):
        s = s.strip("[]").split(",")[0]
    return float(s)


def compact_booster(path: str) -> dict:
    """XGBoost JSON model -> {objective, base_margin, trees:[{l,r,f,t,d}]} (leaves have l = -1, t = leaf value)."""
    m = load_json(path)
    learner = m["learner"]
    objective = learner["objective"]["name"]
    base = parse_base_score(learner["learner_model_param"]["base_score"])
    if objective.startswith("binary:logistic") or objective == "reg:logistic":
        base_margin = math.log(base / (1.0 - base))
    elif objective in ("reg:squarederror", "reg:absoluteerror", "reg:quantileerror", "reg:pseudohubererror",
                       "reg:squaredlogerror", "binary:logitraw"):
        base_margin = base
    else:
        raise ValueError(f"{path}: unsupported objective {objective}")
    num_class = int(learner["learner_model_param"].get("num_class", "0") or 0)
    num_target = int(learner["learner_model_param"].get("num_target", "1") or 1)
    if num_class > 1 or num_target > 1:
        raise ValueError(f"{path}: multi-output models are not supported")

    gb = learner["gradient_booster"]
    if gb.get("name") not in (None, "gbtree"):
        raise ValueError(f"{path}: only gbtree boosters are supported")
    model = gb["model"]
    trees = model["trees"]
    best = learner.get("attributes", {}).get("best_iteration")
    indptr = model.get("iteration_indptr")
    if best is not None and indptr:
        trees = trees[: indptr[int(best) + 1]]

    out = []
    for t in trees:
        if any(t.get("split_type", [])):
            raise ValueError(f"{path}: categorical splits are not supported")
        out.append({
            "l": t["left_children"],
            "r": t["right_children"],
            "f": t["split_indices"],
            "t": t["split_conditions"],
            "d": t["default_left"],
        })
    return {"objective": objective, "base_margin": base_margin, "trees": out}


def load_variable(var: str, d: str):
    point = os.path.join(d, "model.json")
    if not os.path.exists(point):
        return None
    meta = load_json(os.path.join(d, "metadata.json")) or {}
    entry = {
        "version": meta.get("model_version", "unknown"),
        "feature_order": meta.get("feature_order") or LEGACY_RAINFALL_FEATURES,
        "point": compact_booster(point),
    }
    qs = {q: os.path.join(d, f"{q}.json") for q in QUANTILES}
    if all(os.path.exists(p) for p in qs.values()):
        entry["quantiles"] = {q: compact_booster(p) for q, p in qs.items()}
    cls = os.path.join(d, "rain_probability.json")
    if var == "rainfall" and os.path.exists(cls):
        entry["prob"] = compact_booster(cls)
    return entry


def export_models() -> dict:
    variables = {}
    for var in VARIABLES:
        m = load_variable(var, os.path.join(MODELS_DIR, var))
        if m is None and var == "rainfall":
            legacy = os.path.join(MODELS_DIR, "xgboost_downscaler.json")
            if os.path.exists(legacy):
                meta = load_json(legacy.replace(".json", "_metadata.json")) or {}
                m = {
                    "version": meta.get("model_version", "unknown"),
                    "feature_order": meta.get("feature_order") or LEGACY_RAINFALL_FEATURES,
                    "point": compact_booster(legacy),
                }
        if m is None:
            continue
        block = load_variable(var, os.path.join(MODELS_DIR, f"{var}_block"))
        if block is not None:
            m["block"] = block
        variables[var] = m
    return {"metrics": load_json(os.path.join(MODELS_DIR, "metrics.json")) or {}, "variables": variables}


# ---- features / boundaries -----------------------------------------------------

def export_features() -> dict:
    df = pd.read_parquet(PARQUET_PATH)
    out = {}
    for row in df.to_dict(orient="records"):
        gp = gp_key(row.get("GPCODE"))
        if gp:
            out[gp] = {k: clean(v) for k, v in row.items()}
    return out


def round_coords(coords, nd=5):
    if coords and isinstance(coords[0], (int, float)):
        return [round(coords[0], nd), round(coords[1], nd)]
    rounded = [round_coords(c, nd) for c in coords]
    if rounded and isinstance(rounded[0], list) and rounded[0] and isinstance(rounded[0][0], float):
        # A ring: drop consecutive duplicates created by rounding.
        dedup = [rounded[0]]
        for p in rounded[1:]:
            if p != dedup[-1]:
                dedup.append(p)
        if len(dedup) >= 4:
            return dedup
    return rounded


def export_geojson(features: dict) -> dict:
    with open(GEOJSON_PATH, encoding="utf-8") as f:
        data = json.load(f)
    for feature in data.get("features", []):
        props = feature.get("properties", {})
        gp = gp_key(props.get("GPCODE"))
        if gp and gp in features:
            props["GPNAME"] = features[gp].get("GPNAME", "")
            props["area_sqkm"] = features[gp].get("area_sqkm", 0.0)
        feature["properties"] = {k: clean(props.get(k)) for k in GEO_PROPS if k in props}
        geom = feature.get("geometry")
        if geom and "coordinates" in geom:
            geom["coordinates"] = round_coords(geom["coordinates"])
    return data


def write(path: str, obj) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    print(f"wrote {os.path.relpath(path, ROOT)} ({os.path.getsize(path) / 1e6:.1f} MB)")


def main() -> int:
    if not os.path.exists(PARQUET_PATH):
        print(f"missing {PARQUET_PATH}", file=sys.stderr)
        return 1
    features = export_features()
    write(os.path.join(WEB, "data", "features.json"), features)
    write(os.path.join(WEB, "data", "models.json"), export_models())
    if os.path.exists(GEOJSON_PATH):
        write(os.path.join(WEB, "public", "data", "panchayats.geojson"), export_geojson(features))
    else:
        print(f"skipped boundaries: missing {GEOJSON_PATH}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
