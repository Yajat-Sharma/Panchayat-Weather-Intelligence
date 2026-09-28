"""
Merge static features, coarse ERA5 inputs and fine references into one training table
(one row per Panchayat per day), and add the block-level coarse inputs used by the
block -> Panchayat model variant.
"""
import logging
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from ml.downscaling.config import COARSE_WEATHER, DATASET, FINE_WEATHER, RAIN_TARGET, STATIC_FEATURES, VARIABLES  # noqa: E402
from ml.downscaling.physics import area_weighted_block_mean, normalise_block  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def _load(path, keys):
    df = pd.read_parquet(path)
    df["GPCODE"] = df["GPCODE"].astype(str)
    return df.drop_duplicates(subset=keys)


def build_dataset():
    static = _load(STATIC_FEATURES, ["GPCODE"])
    coarse = _load(COARSE_WEATHER, ["GPCODE", "date"])
    df = coarse.merge(static, on="GPCODE", how="inner")

    if RAIN_TARGET.exists():
        target = _load(RAIN_TARGET, ["GPCODE", "date"])[["GPCODE", "date", "target_rainfall_mm"]]
        df = df.merge(target, on=["GPCODE", "date"], how="left")
    if FINE_WEATHER.exists():
        df = df.merge(_load(FINE_WEATHER, ["GPCODE", "date"]), on=["GPCODE", "date"], how="left")

    df["date"] = pd.to_datetime(df["date"])
    df["day_of_year"] = df["date"].dt.dayofyear
    df["month"] = df["date"].dt.month
    if "cell_elevation_m" in df:
        df["elev_diff_m"] = df["elevation_mean"] - df["cell_elevation_m"]
    if {"target_rainfall_mm", "era5_rainfall_mm"} <= set(df.columns):
        df["residual_rainfall_mm"] = df["target_rainfall_mm"] - df["era5_rainfall_mm"]  # v1 column

    # Block -> Panchayat: area-weighted block mean of every coarse input (and the cell elevation)
    df["block_key"] = df["blkname"].map(normalise_block)
    coarse_cols = [s["coarse"] for s in VARIABLES.values() if s["coarse"] in df] + \
                  (["cell_elevation_m"] if "cell_elevation_m" in df else [])
    df = pd.concat([df, area_weighted_block_mean(df, coarse_cols)], axis=1)

    DATASET.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(DATASET, index=False)
    trainable = [v for v, s in VARIABLES.items() if {s["coarse"], s["target"]} <= set(df.columns)]
    logger.info(f"Saved {len(df)} rows ({df['GPCODE'].nunique()} Panchayats x {df['date'].nunique()} days) -> {DATASET}")
    logger.info(f"Trainable variables: {trainable}")


if __name__ == "__main__":
    build_dataset()
