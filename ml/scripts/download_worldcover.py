"""
ESA WorldCover 2021 (v200, 10 m) for the Panchayat extent, from the public AWS bucket
`esa-worldcover` (no credentials). Tiles are Cloud-Optimised GeoTIFFs, so only the study
window is read, from the 4x overview (~37 m) which is ample for per-Panchayat fractions.

Output: data/raw/landcover/worldcover_2021_pune.tif (uint8 class codes)
"""
import math
import sys
from pathlib import Path

import geopandas as gpd
import rasterio
from rasterio.enums import Resampling
from rasterio.merge import merge

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from ml.downscaling.config import BOUNDARIES, WORLDCOVER  # noqa: E402

URL = "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_{tile}_Map.tif"
NATIVE_RES = 1 / 12000  # 10 m in degrees
OVERVIEW = 4
BUFFER_DEG = 0.05


def tile_names(west, south, east, north):
    """WorldCover tiles are 3x3° named by their south-west corner, e.g. N18E072."""
    names = []
    for lat in range(int(math.floor(south / 3) * 3), int(math.ceil(north / 3) * 3), 3):
        for lon in range(int(math.floor(west / 3) * 3), int(math.ceil(east / 3) * 3), 3):
            names.append(f"{'N' if lat >= 0 else 'S'}{abs(lat):02d}{'E' if lon >= 0 else 'W'}{abs(lon):03d}")
    return names


def download_worldcover(force=False):
    if WORLDCOVER.exists() and not force:
        print(f"skip: {WORLDCOVER} exists")
        return WORLDCOVER
    west, south, east, north = gpd.read_file(BOUNDARIES).to_crs("EPSG:4326").total_bounds
    bounds = (west - BUFFER_DEG, south - BUFFER_DEG, east + BUFFER_DEG, north + BUFFER_DEG)
    tiles = tile_names(*bounds)
    print(f"Reading WorldCover tiles {tiles} over {tuple(round(b, 3) for b in bounds)}")
    srcs = [rasterio.open(f"/vsicurl/{URL.format(tile=t)}") for t in tiles]
    try:
        res = NATIVE_RES * OVERVIEW
        mosaic, transform = merge(srcs, bounds=bounds, res=(res, res), resampling=Resampling.nearest, nodata=0)
        profile = srcs[0].profile.copy()
    finally:
        for s in srcs:
            s.close()
    profile.update(driver="GTiff", height=mosaic.shape[1], width=mosaic.shape[2], transform=transform,
                   compress="deflate", tiled=True, nodata=0, count=1)
    WORLDCOVER.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(WORLDCOVER, "w", **profile) as dst:
        dst.write(mosaic)
    print(f"Saved {WORLDCOVER} ({mosaic.shape[2]}x{mosaic.shape[1]})")
    return WORLDCOVER


if __name__ == "__main__":
    download_worldcover(force="--force" in sys.argv)
