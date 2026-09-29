"""
Static per-Panchayat features.

v1: area, centroid, elevation statistics (min/max/mean/std/p10/p50/p90) from the Copernicus 30 m DEM.
v2 (Phase 2, added when inputs exist):
  * slope mean/std, aspect (circular mean as sin/cos), TPI  -- from the DEM resampled to ~90 m
  * ESA WorldCover 2021 fractions: cropland, tree, built-up, water
  * distance (km) from the Panchayat to the nearest WorldCover water pixel (mean over the polygon)

Whether v2 features are actually used is decided by spatial-block CV
(run_spatial_block_validation.py); see data/models/metrics.json.
"""
import sys
import warnings
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import rasterio
from rasterio.enums import Resampling
from rasterstats import zonal_stats

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from ml.downscaling.config import BOUNDARIES, DEM, STATIC_FEATURES, WORLDCOVER  # noqa: E402
from ml.downscaling.terrain import class_fractions, distance_to_class_km, slope_aspect, tpi  # noqa: E402

warnings.filterwarnings("ignore", message=".*geographic CRS.*")

TERRAIN_DECIMATE = 3         # 30 m -> ~90 m for slope/aspect/TPI
TPI_RADIUS_PX = 7            # ~1.3 km neighbourhood at 90 m
WATER_DECIMATE = 3           # ~37 m WorldCover -> ~110 m for the distance transform

RETAIN = [
    "GPCODE", "GPNAME", "blkname", "dtname",
    "area_sqkm", "centroid_lat", "centroid_lon",
    "elevation_min", "elevation_max", "elevation_mean",
    "elevation_std", "elevation_p10", "elevation_p50", "elevation_p90",
    "slope_mean", "slope_std", "aspect_sin", "aspect_cos", "tpi_mean",
    "lc_cropland", "lc_tree", "lc_built", "lc_water", "dist_water_km",
]


def read_decimated(path, factor, resampling):
    with rasterio.open(path) as src:
        h, w = src.height // factor, src.width // factor
        arr = src.read(1, out_shape=(h, w), resampling=resampling, masked=True)
        transform = src.transform * src.transform.scale(src.width / w, src.height / h)
    return arr, transform


def elevation_stats(gdf):
    def pct(x):
        if x.mask.all():
            return {"p10": np.nan, "p50": np.nan, "p90": np.nan}
        v = x.compressed()
        return {"p10": np.percentile(v, 10), "p50": np.percentile(v, 50), "p90": np.percentile(v, 90)}

    stats = zonal_stats(gdf, str(DEM), stats=["min", "max", "mean", "std"], add_stats={"pct": pct}, nodata=np.nan)
    out = pd.DataFrame([{
        "elevation_min": s.get("min"), "elevation_max": s.get("max"),
        "elevation_mean": s.get("mean"), "elevation_std": s.get("std"),
        **{f"elevation_{k}": v for k, v in (s.get("pct") or {"p10": np.nan, "p50": np.nan, "p90": np.nan}).items()},
    } for s in stats], index=gdf.index)
    return out


def terrain_stats(gdf):
    dem, transform = read_decimated(DEM, TERRAIN_DECIMATE, Resampling.average)
    dem = dem.filled(np.nan).astype("float64")
    slope, aspect = slope_aspect(dem, transform)
    tp = tpi(dem, TPI_RADIUS_PX)
    rad = np.deg2rad(aspect)
    flat = slope < 1.0  # aspect is meaningless on flat ground
    sin_a = np.where(flat, np.nan, np.sin(rad))
    cos_a = np.where(flat, np.nan, np.cos(rad))

    def zs(arr, stats):
        return zonal_stats(gdf, arr, affine=transform, stats=stats, nodata=np.nan, all_touched=True)

    s_slope = zs(slope, ["mean", "std"])
    s_sin, s_cos, s_tpi = zs(sin_a, ["mean"]), zs(cos_a, ["mean"]), zs(tp, ["mean"])
    out = pd.DataFrame({
        "slope_mean": [s["mean"] for s in s_slope],
        "slope_std": [s["std"] for s in s_slope],
        "tpi_mean": [s["mean"] for s in s_tpi],
    }, index=gdf.index)
    # circular mean of aspect, re-normalised to a unit vector (0,0 on flat Panchayats)
    sin_m = np.array([s["mean"] if s["mean"] is not None else 0.0 for s in s_sin])
    cos_m = np.array([s["mean"] if s["mean"] is not None else 0.0 for s in s_cos])
    norm = np.hypot(sin_m, cos_m)
    out["aspect_sin"] = np.divide(sin_m, norm, out=np.zeros_like(sin_m), where=norm > 0)
    out["aspect_cos"] = np.divide(cos_m, norm, out=np.zeros_like(cos_m), where=norm > 0)
    return out


def landcover_stats(gdf):
    counts = zonal_stats(gdf, str(WORLDCOVER), categorical=True, nodata=0, all_touched=True)
    out = pd.DataFrame([class_fractions(c) for c in counts], index=gdf.index)
    lc, transform = read_decimated(WORLDCOVER, WATER_DECIMATE, Resampling.mode)
    dist = distance_to_class_km(lc.filled(0), transform, target=80)
    out["dist_water_km"] = [s["mean"] for s in zonal_stats(gdf, dist, affine=transform, stats=["mean"],
                                                           nodata=np.nan, all_touched=True)]
    return out


def extract_dem_features():
    print(f"Loading boundaries from {BOUNDARIES}")
    gdf = gpd.read_file(BOUNDARIES).to_crs("EPSG:4326").reset_index(drop=True)
    utm = gdf.to_crs(epsg=32643)
    gdf["area_sqkm"] = utm.geometry.area / 1e6
    cent = utm.geometry.centroid.to_crs("EPSG:4326")  # centroid in a projected CRS, reported in lat/lon
    gdf["centroid_lat"], gdf["centroid_lon"] = cent.y, cent.x

    print(f"Elevation statistics from {DEM}")
    parts = [elevation_stats(gdf)]
    print("Slope / aspect / TPI")
    parts.append(terrain_stats(gdf))
    if WORLDCOVER.exists():
        print(f"Land-cover fractions and distance to water from {WORLDCOVER}")
        parts.append(landcover_stats(gdf))
    else:
        print(f"WorldCover not found at {WORLDCOVER}; run download_worldcover.py for the land-cover features.")

    df = pd.concat([pd.DataFrame(gdf.drop(columns="geometry"))] + parts, axis=1)
    df = df[[c for c in RETAIN if c in df.columns]]
    STATIC_FEATURES.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(STATIC_FEATURES, index=False)
    print(f"Saved {len(df)} records to {STATIC_FEATURES}")


if __name__ == "__main__":
    extract_dem_features()
