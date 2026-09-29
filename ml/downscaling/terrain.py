"""Terrain and land-cover descriptors computed with numpy on a geographic (EPSG:4326) grid."""
import numpy as np
from scipy import ndimage

M_PER_DEG_LAT = 110_540.0
M_PER_DEG_LON_EQ = 111_320.0

WORLDCOVER_CLASSES = {"lc_tree": 10, "lc_cropland": 40, "lc_built": 50, "lc_water": 80}


def pixel_size_m(transform, n_rows):
    """Per-row pixel width/height in metres for a north-up lat/lon raster."""
    res_x, res_y = transform.a, -transform.e
    lat = transform.f - (np.arange(n_rows) + 0.5) * res_y
    dx = res_x * M_PER_DEG_LON_EQ * np.cos(np.deg2rad(lat))
    dy = np.full(n_rows, res_y * M_PER_DEG_LAT)
    return dx, dy


def slope_aspect(dem: np.ndarray, transform):
    """
    Slope (degrees) and aspect (degrees clockwise from north, direction the slope faces)
    via central differences. NaNs propagate.
    """
    dx, dy = pixel_size_m(transform, dem.shape[0])
    dz_dy_rows, dz_dx_cols = np.gradient(dem)
    dz_dx = dz_dx_cols / dx[:, None]      # east positive
    dz_dn = -dz_dy_rows / dy[:, None]     # rows increase southward -> flip for north positive
    slope = np.degrees(np.arctan(np.hypot(dz_dx, dz_dn)))
    aspect = (np.degrees(np.arctan2(-dz_dx, -dz_dn)) + 360.0) % 360.0
    return slope, aspect


def tpi(dem: np.ndarray, radius_px: int) -> np.ndarray:
    """Topographic position index: elevation minus the mean of a (2r+1)^2 neighbourhood (NaN-aware)."""
    valid = np.isfinite(dem)
    filled = np.where(valid, dem, 0.0)
    size = 2 * radius_px + 1
    s = ndimage.uniform_filter(filled, size=size, mode="nearest")
    c = ndimage.uniform_filter(valid.astype(float), size=size, mode="nearest")
    mean = np.divide(s, c, out=np.full_like(s, np.nan), where=c > 0)
    return np.where(valid, dem - mean, np.nan)


def distance_to_class_km(classes: np.ndarray, transform, target: int) -> np.ndarray:
    """Distance (km) from every pixel to the nearest pixel of `target` class (Euclidean, local metric scale)."""
    dx, dy = pixel_size_m(transform, classes.shape[0])
    sampling = (float(dy.mean()), float(dx.mean()))
    mask = classes != target
    if mask.all():
        return np.full(classes.shape, np.nan)
    return ndimage.distance_transform_edt(mask, sampling=sampling) / 1000.0


def class_fractions(counts: dict) -> dict:
    """zonal_stats(categorical=True) counts -> fraction of each tracked WorldCover class."""
    total = sum(v for k, v in counts.items() if k not in (0, None))
    return {name: (counts.get(code, 0) / total if total else np.nan) for name, code in WORLDCOVER_CLASSES.items()}
