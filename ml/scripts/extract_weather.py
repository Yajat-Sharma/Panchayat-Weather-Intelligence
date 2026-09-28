"""
Multi-variable weather extraction to Panchayat centroids.

Hourly UTC data are aggregated to calendar days in IST (UTC+5:30) so a training "day"
matches the operational forecast (requested with timezone=Asia/Kolkata).

Outputs (one row per Panchayat per day):
  data/processed/weather/panchayat_era5_weather.parquet      coarse ERA5 0.25°
      era5_rainfall_mm, era5_tmax_c, era5_tmin_c, era5_rh_pct, era5_wind_kmh, cell_elevation_m
  data/processed/weather/panchayat_era5land_weather.parquet  fine ERA5-Land 0.1°
      fine_tmax_c, fine_tmin_c, fine_rh_pct, fine_wind_kmh

Variables whose source file is missing are skipped (e.g. precipitation-only v1 setup).
"""
import logging
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import xarray as xr

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from ml.downscaling.config import (  # noqa: E402
    COARSE_WEATHER, ERA5_GEOPOTENTIAL_NC, ERA5_LAND_NC, ERA5_RAIN_NC, ERA5_SURFACE_NC, FINE_WEATHER, STATIC_FEATURES,
)
from ml.downscaling.physics import G, daily_ist, magnus_rh, time_dim, wind_speed_kmh  # noqa: E402

warnings.filterwarnings("ignore")
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

K = 273.15


def load_points() -> pd.DataFrame:
    df = pd.read_parquet(STATIC_FEATURES)
    df = df.dropna(subset=["GPCODE", "centroid_lat", "centroid_lon"]).drop_duplicates("GPCODE")
    return df[["GPCODE", "centroid_lat", "centroid_lon"]].reset_index(drop=True)


def _coords(ds):
    lat = "latitude" if "latitude" in ds.coords else "lat"
    lon = "longitude" if "longitude" in ds.coords else "lon"
    return lat, lon


def at_points(da: xr.DataArray, pts: pd.DataFrame) -> xr.DataArray:
    """Nearest grid cell for each Panchayat centroid -> (time, location)."""
    lat, lon = _coords(da)
    return da.sel({lat: xr.DataArray(pts["centroid_lat"].values, dims="location"),
                   lon: xr.DataArray(pts["centroid_lon"].values, dims="location")}, method="nearest")


def to_long(daily: dict, pts: pd.DataFrame) -> pd.DataFrame:
    """{column: DataArray(time, location)} -> long DataFrame (GPCODE, date, columns...)."""
    first = next(iter(daily.values()))
    tdim = time_dim(first)
    dates = pd.to_datetime(first[tdim].values).strftime("%Y-%m-%d")
    n_t, n_l = len(dates), len(pts)
    out = pd.DataFrame({"GPCODE": np.tile(pts["GPCODE"].astype(str).values, n_t), "date": np.repeat(dates, n_l)})
    for col, da in daily.items():
        da = da.transpose(tdim, "location").reindex({tdim: first[tdim]})
        out[col] = da.values.reshape(-1)
    return out


def surface_daily(ds: xr.Dataset, prefix: str, pts: pd.DataFrame) -> dict:
    t = at_points(ds["t2m"], pts) - K
    td = at_points(ds["d2m"], pts) - K
    rh = xr.apply_ufunc(magnus_rh, t, td, dask="allowed")
    ws = xr.apply_ufunc(wind_speed_kmh, at_points(ds["u10"], pts), at_points(ds["v10"], pts), dask="allowed")
    return {
        f"{prefix}_tmax_c": daily_ist(t, "max"),
        f"{prefix}_tmin_c": daily_ist(t, "min"),
        f"{prefix}_rh_pct": daily_ist(rh, "mean"),
        f"{prefix}_wind_kmh": daily_ist(ws, "mean"),
    }


def extract_coarse(pts: pd.DataFrame) -> pd.DataFrame:
    daily = {}
    if ERA5_RAIN_NC.exists():
        logger.info("ERA5 precipitation -> IST daily totals")
        ds = xr.open_dataset(ERA5_RAIN_NC)
        daily["era5_rainfall_mm"] = daily_ist(at_points(ds["tp"], pts) * 1000.0, "sum")
    if ERA5_SURFACE_NC.exists():
        logger.info("ERA5 surface variables -> IST daily Tmax/Tmin/RH/wind")
        daily.update(surface_daily(xr.open_dataset(ERA5_SURFACE_NC), "era5", pts))
    if not daily:
        raise FileNotFoundError(f"No ERA5 files found ({ERA5_RAIN_NC}, {ERA5_SURFACE_NC}).")
    df = to_long(daily, pts)

    if ERA5_GEOPOTENTIAL_NC.exists():
        z = xr.open_dataset(ERA5_GEOPOTENTIAL_NC)["z"]
        z = z.isel({time_dim(z): 0}) if any(d in z.dims for d in ("time", "valid_time")) else z
        elev = at_points(z, pts).values / G
        df["cell_elevation_m"] = df["GPCODE"].map(dict(zip(pts["GPCODE"].astype(str), elev)))
    else:
        logger.warning("ERA5 geopotential missing: temperature lapse-rate baseline will fall back to the coarse value.")
    return df


def extract_fine(pts: pd.DataFrame) -> pd.DataFrame:
    logger.info("ERA5-Land -> IST daily Tmax/Tmin/RH/wind")
    return to_long(surface_daily(xr.open_dataset(ERA5_LAND_NC), "fine", pts), pts)


def main():
    pts = load_points()
    COARSE_WEATHER.parent.mkdir(parents=True, exist_ok=True)
    coarse = extract_coarse(pts)
    coarse.to_parquet(COARSE_WEATHER, index=False)
    logger.info(f"Saved {len(coarse)} rows -> {COARSE_WEATHER}")
    if ERA5_LAND_NC.exists():
        fine = extract_fine(pts)
        fine.to_parquet(FINE_WEATHER, index=False)
        logger.info(f"Saved {len(fine)} rows -> {FINE_WEATHER}")
    else:
        logger.warning(f"{ERA5_LAND_NC} missing: only rainfall can be trained.")


# Kept for callers of the v1 entry point.
extract_era5_to_panchayats = main

if __name__ == "__main__":
    main()
