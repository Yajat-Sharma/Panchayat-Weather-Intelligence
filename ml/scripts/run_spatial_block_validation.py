"""
Spatial-block cross-validation (K-Means on centroids, K=5) for every trainable variable.

For each variable:
  1. Point model with v1 features and, if present, v2 features (slope/aspect/TPI/land cover/water).
     The deployed feature set is v2 only if it lowers pooled RMSE; otherwise v1 (Phase 2 rule).
  2. Quantile models (p10/p50/p90) -> empirical coverage of the 80% interval.
  3. Rainfall only: P(rain > 2.5 mm) classifier -> Brier score vs climatology, AUC.
  4. Block-input variant: coarse input = area-weighted block mean of ERA5.

Writes data/models/metrics.json (served by GET /api/v1/metrics) and out-of-fold predictions.
"""
import json
import sys
import warnings
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from ml.downscaling.config import (  # noqa: E402
    DATASET, MODELS_DIR, N_FOLDS, PREDICTIONS_DIR, STATIC_V2_EXTRA, VALIDATION_DIR, VARIABLES, YEAR,
)
from ml.downscaling.training import cross_validate  # noqa: E402

warnings.filterwarnings("ignore")

# v2 static features are adopted only if they cut pooled RMSE by at least this fraction;
# smaller gains are indistinguishable from fold-to-fold noise.
MIN_RELATIVE_GAIN = 0.01


def trainable(df):
    return [v for v, s in VARIABLES.items() if {s["coarse"], s["target"]} <= set(df.columns)
            and df[s["target"]].notna().any()]


def validate_variable(df, var, log=print):
    spec = VARIABLES[var]
    log(f"\n=== {var} ({spec['unit']}) vs {spec['reference']} ===")
    v1, oof = cross_validate(df, var, "v1", uncertainty=True)
    log(f"v1 RMSE {v1['point']['baseline_rmse']:.3f} -> {v1['point']['model_rmse']:.3f} "
        f"({v1['point']['rmse_reduction_percent']:.2f}%)")
    chosen, comparison = v1, {"v1": v1["point"]["model_rmse"]}

    if all(c in df.columns and df[c].notna().any() for c in STATIC_V2_EXTRA):
        v2, oof2 = cross_validate(df, var, "v2", uncertainty=True)
        comparison["v2"] = v2["point"]["model_rmse"]
        log(f"v2 RMSE {v2['point']['model_rmse']:.3f} ({v2['point']['rmse_reduction_percent']:.2f}%)")
        if v2["point"]["model_rmse"] < v1["point"]["model_rmse"] * (1 - MIN_RELATIVE_GAIN):
            chosen, oof = v2, oof2
    log(f"feature set: {chosen['feature_set']}")

    if "interval" in chosen:
        log(f"80% interval coverage {chosen['interval']['coverage']:.3f}, width {chosen['interval']['mean_width']:.2f}")

    block, _ = cross_validate(df, var, chosen["feature_set"], mode="block")
    log(f"block-input RMSE {block['point']['baseline_rmse']:.3f} -> {block['point']['model_rmse']:.3f} "
        f"({block['point']['rmse_reduction_percent']:.2f}%)")

    result = {
        "unit": spec["unit"],
        "reference": spec["reference"],
        "coarse_input": "ERA5 (0.25°)",
        "baseline": "lapse_rate_6.5C_per_km" if spec["baseline"] == "lapse" else "coarse_value",
        **{k: chosen[k] for k in ("feature_set", "panchayats", "rows", "point")},
        "feature_set_comparison_rmse": comparison,
        "feature_set_rule": f"v2 only if pooled RMSE improves by >= {MIN_RELATIVE_GAIN:.0%}",
        "interval": chosen.get("interval"),
        "rain_probability": chosen.get("rain_probability"),
        "heavy_rainfall": chosen.get("heavy_rainfall"),
        "block_input": {k: block["point"][k] for k in block["point"] if k != "folds"},
    }
    return result, oof


def main():
    df = pd.read_parquet(DATASET)
    df["GPCODE"] = df["GPCODE"].astype(str)
    variables = trainable(df)
    if not variables:
        raise SystemExit("No variable has both a coarse input and a fine reference in the dataset.")

    metrics = {
        "source": "run_spatial_block_validation",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "validation": f"spatial_block_kmeans_k{N_FOLDS}",
        "period": f"{YEAR}-01-01 to {YEAR}-12-31",
        "variables": {},
    }
    PREDICTIONS_DIR.mkdir(parents=True, exist_ok=True)
    VALIDATION_DIR.mkdir(parents=True, exist_ok=True)
    for var in variables:
        res, oof = validate_variable(df, var)
        metrics["variables"][var] = res
        oof.to_parquet(PREDICTIONS_DIR / f"spatial_block_oof_{var}.parquet", index=False)
        if var == "rainfall":
            # Column names the historical-weather endpoint / UI chart already use.
            oof.rename(columns={"coarse": "era5_rainfall_mm", "target": "target_rainfall_mm",
                                "downscaled": "downscaled_rainfall_mm"}).to_parquet(
                PREDICTIONS_DIR / "spatial_block_oof_predictions.parquet", index=False)

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    for path in (MODELS_DIR / "metrics.json", VALIDATION_DIR / "spatial_block_metrics.json"):
        with open(path, "w") as f:
            json.dump(metrics, f, indent=2, ensure_ascii=False)
    print(f"\nWrote {MODELS_DIR / 'metrics.json'}")


if __name__ == "__main__":
    main()
