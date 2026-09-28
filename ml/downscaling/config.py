"""Shared paths and the per-variable configuration for the multi-variable downscaling pipeline."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
# PWI_DATA_DIR lets the whole pipeline run against another data tree (e.g. a synthetic smoke test).
DATA = Path(os.environ.get("PWI_DATA_DIR", BASE_DIR / "data"))
RAW = DATA / "raw"
PROCESSED = DATA / "processed"
MODELS_DIR = DATA / "models"

BOUNDARIES = DATA / "interim" / "boundaries" / "pune_panchayats_valid.geojson"
DEM = RAW / "terrain" / "pune_dem.tif"
WORLDCOVER = RAW / "landcover" / "worldcover_2021_pune.tif"
ERA5_RAIN_NC = RAW / "weather" / "era5_pune_2023.nc"            # total precipitation (v1 file)
ERA5_SURFACE_NC = RAW / "weather" / "era5_surface_pune_2023.nc"  # t2m, d2m, u10, v10
ERA5_GEOPOTENTIAL_NC = RAW / "weather" / "era5_geopotential_pune.nc"
ERA5_LAND_NC = RAW / "weather" / "era5_land_pune_2023.nc"
CHIRPS_NC = RAW / "target" / "chirps_p05_2023.nc"

STATIC_FEATURES = PROCESSED / "features" / "panchayat_static_features.parquet"
COARSE_WEATHER = PROCESSED / "weather" / "panchayat_era5_weather.parquet"
FINE_WEATHER = PROCESSED / "weather" / "panchayat_era5land_weather.parquet"
RAIN_TARGET = PROCESSED / "targets" / "panchayat_rainfall_target.parquet"
DATASET = PROCESSED / "features" / "panchayat_downscaling_dataset.parquet"
VALIDATION_DIR = PROCESSED / "validation"
PREDICTIONS_DIR = PROCESSED / "predictions"

YEAR = "2023"
IST_OFFSET = "5h30min"
LAPSE_RATE_C_PER_M = -0.0065
RAIN_EVENT_MM = 2.5
QUANTILES = {"p10": 0.1, "p50": 0.5, "p90": 0.9}
N_FOLDS = 5
SEED = 42

XGB_PARAMS = {"n_estimators": 100, "learning_rate": 0.1, "max_depth": 6, "random_state": SEED, "n_jobs": -1,
              "tree_method": "hist"}

# Features ------------------------------------------------------------------

STATIC_V1 = [
    "elevation_min", "elevation_max", "elevation_mean", "elevation_std",
    "elevation_p10", "elevation_p50", "elevation_p90",
    "area_sqkm", "centroid_lat", "centroid_lon",
]
# Phase 2 additions. Each is kept only if it improves spatial-block CV (see run_spatial_block_validation.py).
STATIC_V2_EXTRA = [
    "slope_mean", "slope_std", "aspect_sin", "aspect_cos", "tpi_mean",
    "lc_cropland", "lc_tree", "lc_built", "lc_water", "dist_water_km",
]
TEMPORAL = ["day_of_year", "month"]
ELEVATION_CONTEXT = ["cell_elevation_m", "elev_diff_m"]

# Variables -----------------------------------------------------------------
# coarse: ERA5 0.25° value at the Panchayat centroid's grid cell
# target: fine reference (CHIRPS 0.05° for rain, ERA5-Land 0.1° for the rest)
VARIABLES = {
    "rainfall": {"coarse": "era5_rainfall_mm", "target": "target_rainfall_mm", "baseline": "coarse",
                 "clip": (0.0, None), "unit": "mm", "reference": "CHIRPS v2.0 (0.05°)",
                 "extra_features": []},
    "tmax": {"coarse": "era5_tmax_c", "target": "fine_tmax_c", "baseline": "lapse",
             "clip": (None, None), "unit": "°C", "reference": "ERA5-Land (0.1°)",
             "extra_features": ELEVATION_CONTEXT},
    "tmin": {"coarse": "era5_tmin_c", "target": "fine_tmin_c", "baseline": "lapse",
             "clip": (None, None), "unit": "°C", "reference": "ERA5-Land (0.1°)",
             "extra_features": ELEVATION_CONTEXT},
    "rh": {"coarse": "era5_rh_pct", "target": "fine_rh_pct", "baseline": "coarse",
           "clip": (0.0, 100.0), "unit": "%", "reference": "ERA5-Land (0.1°)",
           "extra_features": ELEVATION_CONTEXT},
    "wind": {"coarse": "era5_wind_kmh", "target": "fine_wind_kmh", "baseline": "coarse",
             "clip": (0.0, None), "unit": "km/h", "reference": "ERA5-Land (0.1°)",
             "extra_features": ELEVATION_CONTEXT},
}


def feature_list(var: str, feature_set: str = "v1") -> list:
    """Model input columns. Rainfall v1 is exactly the deployed v1 schema."""
    spec = VARIABLES[var]
    static = STATIC_V1 + (STATIC_V2_EXTRA if feature_set == "v2" else [])
    return [spec["coarse"]] + static + TEMPORAL + spec["extra_features"]
