"""
Train production models on all 2023 data for every variable validated in metrics.json.

    data/models/<var>/model.json            residual point model
    data/models/<var>/p10|p50|p90.json      residual quantile models
    data/models/rainfall/rain_probability.json
    data/models/<var>_block/...             block-input variant (block mean ERA5 -> Panchayat)
    .../metadata.json                       feature order, version, validation summary

The API (apps/api/app/inference.py) loads whatever is present. The v1 rainfall model
(data/models/xgboost_downscaler.json) is left untouched.
"""
import json
import sys
import warnings
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from ml.downscaling.config import DATASET, MODELS_DIR, VARIABLES, XGB_PARAMS, YEAR  # noqa: E402
from ml.downscaling.training import fit_all  # noqa: E402

warnings.filterwarnings("ignore")


def save(var, mode, fitted, feature_set, validation):
    out = MODELS_DIR / (var if mode == "point" else f"{var}_block")
    out.mkdir(parents=True, exist_ok=True)
    for name, model in fitted["models"].items():
        model.save_model(out / f"{name}.json")
    spec = VARIABLES[var]
    meta = {
        "model_version": f"{var}_downscaler_{feature_set}{'_block' if mode == 'block' else ''}_{YEAR}",
        "variable": var,
        "unit": spec["unit"],
        "input_mode": mode,
        "coarse_input": ("area-weighted block mean of " if mode == "block" else "") + "ERA5 0.25°",
        "reference": spec["reference"],
        "baseline": "lapse_rate_6.5C_per_km" if spec["baseline"] == "lapse" else "coarse_value",
        "feature_set": feature_set,
        "feature_order": fitted["feature_order"],
        "training_rows": fitted["rows"],
        "training_period": f"{YEAR}-01-01 to {YEAR}-12-31",
        "xgboost_parameters": {k: v for k, v in XGB_PARAMS.items() if k != "n_jobs"},
        "companions": sorted(k for k in fitted["models"] if k != "model"),
        "validation": validation,
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    with open(out / "metadata.json", "w") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)
    print(f"  -> {out}")


def main():
    with open(MODELS_DIR / "metrics.json") as f:
        metrics = json.load(f)
    if metrics.get("source") != "run_spatial_block_validation":
        raise SystemExit("metrics.json is not from run_spatial_block_validation.py; run validation first.")
    df = pd.read_parquet(DATASET)
    df["GPCODE"] = df["GPCODE"].astype(str)
    for var, m in metrics["variables"].items():
        fs = m["feature_set"]
        print(f"{var}: training on all data with feature set {fs}")
        save(var, "point", fit_all(df, var, fs, "point"), fs, {k: m.get(k) for k in ("point", "interval", "rain_probability")})
        save(var, "block", fit_all(df, var, fs, "block"), fs, m.get("block_input"))


if __name__ == "__main__":
    main()
