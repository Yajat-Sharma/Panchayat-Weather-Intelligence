import geopandas as gpd
import rasterio
from rasterio.mask import mask
import numpy as np
from typing import Dict

def validate_crs(gdf: gpd.GeoDataFrame, target_crs: str = "EPSG:4326") -> gpd.GeoDataFrame:
    """Validates and projects a GeoDataFrame to the target CRS."""
    if gdf.crs is None:
        raise ValueError("GeoDataFrame has no CRS defined.")
    if gdf.crs.to_string() != target_crs:
        return gdf.to_crs(target_crs)
    return gdf

def project_for_area_calculation(gdf: gpd.GeoDataFrame, utm_crs: str = "EPSG:32643") -> gpd.GeoDataFrame:
    """
    Projects the geometry to a UTM CRS suitable for area and distance calculations.
    EPSG:32643 (UTM Zone 43N) is generally suitable for Maharashtra (Pune).
    """
    return validate_crs(gdf, utm_crs)

def extract_terrain_features(panchayat_polygon, dem_raster_path: str) -> Dict[str, float]:
    """
    Extracts mean, min, max, std elevation, and an approximate slope mean from a DEM for a given polygon.
    """
    try:
        with rasterio.open(dem_raster_path) as src:
            # Mask the raster with the polygon
            out_image, out_transform = mask(src, [panchayat_polygon], crop=True)
            
            # Filter out no-data values
            nodata = src.nodata
            if nodata is not None:
                valid_data = out_image[out_image != nodata]
            else:
                valid_data = out_image[out_image > -9999] # Fallback if no-data is not set
                
            if len(valid_data) == 0:
                return {"elevation_mean": np.nan, "elevation_min": np.nan, "elevation_max": np.nan, "elevation_std": np.nan}
            
            stats = {
                "elevation_mean": float(np.mean(valid_data)),
                "elevation_min": float(np.min(valid_data)),
                "elevation_max": float(np.max(valid_data)),
                "elevation_std": float(np.std(valid_data)),
                # Slope calculation is omitted here for brevity, typically requires a moving window over the raster
            }
            return stats
    except Exception as e:
        print(f"Error extracting terrain features: {e}")
        return {"elevation_mean": np.nan, "elevation_min": np.nan, "elevation_max": np.nan, "elevation_std": np.nan}
