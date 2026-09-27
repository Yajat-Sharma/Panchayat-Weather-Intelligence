import pandas as pd
import geopandas as gpd
from typing import List, Dict

def build_panchayat_features(panchayats_gdf: gpd.GeoDataFrame, terrain_stats: List[Dict]) -> pd.DataFrame:
    """
    Builds a standardized feature table for Panchayats.
    
    :param panchayats_gdf: GeoDataFrame containing panchayats (must have 'id', 'name', 'block_id', 'district_id')
    :param terrain_stats: List of dictionaries containing terrain features matching the row order of panchayats_gdf
    :return: DataFrame formatted as a standardized feature table
    """
    df = pd.DataFrame(panchayats_gdf.drop(columns=['geometry']))
    
    # Calculate centroids (requires geographic or projected CRS, using geographic for lat/lon representation)
    centroids = panchayats_gdf.geometry.centroid
    df['centroid_lat'] = centroids.y
    df['centroid_lon'] = centroids.x
    
    # Calculate area in km^2 using an equal-area or appropriate UTM projection
    # For robust production use, we project specifically for area
    projected = panchayats_gdf.to_crs("EPSG:32643")
    df['area_km2'] = projected.geometry.area / 1e6
    
    # Merge terrain stats
    terrain_df = pd.DataFrame(terrain_stats)
    df = pd.concat([df.reset_index(drop=True), terrain_df.reset_index(drop=True)], axis=1)
    
    return df

def save_features(df: pd.DataFrame, filepath: str):
    """Saves the feature table to a Parquet file."""
    df.to_parquet(filepath, index=False)
