"""Small, tested physical helpers used by extraction and training."""
import numpy as np
import pandas as pd
import xarray as xr

from .config import IST_OFFSET, LAPSE_RATE_C_PER_M

G = 9.80665  # m s-2, converts ERA5 geopotential (m2 s-2) to height


def magnus_rh(t_c, td_c):
    """Relative humidity (%) from air and dew-point temperature (°C), Magnus formula (Alduchov & Eskridge 1996)."""
    a, b = 17.625, 243.04
    t_c, td_c = np.asarray(t_c, float), np.asarray(td_c, float)
    rh = 100.0 * np.exp(a * td_c / (b + td_c) - a * t_c / (b + t_c))
    return np.clip(rh, 0.0, 100.0)


def wind_speed_kmh(u, v):
    """Wind speed (km/h) from u/v components (m/s)."""
    return np.hypot(np.asarray(u, float), np.asarray(v, float)) * 3.6


def lapse_rate_baseline(coarse_t, panchayat_elev, cell_elev, lapse=LAPSE_RATE_C_PER_M):
    """Coarse temperature moved to the Panchayat's elevation with a standard lapse rate (6.5 °C/km)."""
    diff = np.nan_to_num(np.asarray(panchayat_elev, float) - np.asarray(cell_elev, float), nan=0.0)
    return np.asarray(coarse_t, float) + lapse * diff


def time_dim(da: xr.DataArray) -> str:
    for name in ("valid_time", "time"):
        if name in da.dims:
            return name
    raise ValueError(f"No time dimension in {list(da.dims)}")


def daily_ist(da: xr.DataArray, how: str) -> xr.DataArray:
    """
    Aggregate hourly UTC data to calendar days in IST (UTC+5:30), so a "day" matches the
    operational forecast requested with timezone=Asia/Kolkata. `how` is sum/mean/max/min.
    Days with fewer than 24 hours (the edges of the record) are dropped.
    """
    tdim = time_dim(da)
    shifted = da.assign_coords({tdim: da[tdim] + pd.Timedelta(IST_OFFSET)})
    grouped = shifted.resample({tdim: "1D"})
    counts = grouped.count()
    agg = getattr(grouped, how)()
    full = counts >= 24
    # count() is per grid cell; a day is complete when every cell has 24 hours
    full = full.all(dim=[d for d in full.dims if d != tdim])
    return agg.sel({tdim: full[tdim][full.values]})


def area_weighted_block_mean(df: pd.DataFrame, value_cols, block_col="block_key", weight_col="area_sqkm",
                             by=("date",)) -> pd.DataFrame:
    """
    For every (block, date) the area-weighted mean of `value_cols` over the block's Panchayats,
    broadcast back onto each row. Returns a frame aligned with `df` with columns `block_<col>`.
    """
    keys = [block_col, *by]
    w = df[weight_col].clip(lower=1e-6).fillna(1.0)
    parts = {}
    for col in value_cols:
        valid = df[col].notna()
        num = (df[col].where(valid, 0) * w * valid).groupby([df[k] for k in keys]).transform("sum")
        den = (w * valid).groupby([df[k] for k in keys]).transform("sum")
        parts[f"block_{col}"] = num / den.replace(0, np.nan)
    return pd.DataFrame(parts, index=df.index)


def normalise_block(name) -> str:
    return str(name or "").strip().lower()
