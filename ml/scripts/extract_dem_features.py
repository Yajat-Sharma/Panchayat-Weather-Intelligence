import os
import geopandas as gpd
import pandas as pd
from rasterstats import zonal_stats
import numpy as np

def extract_dem_features():
    base = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    boundary_path = os.path.join(base, "data", "interim", "boundaries", "pune_panchayats_valid.geojson")
    dem_path = os.path.join(base, "data", "raw", "terrain", "pune_dem.tif")
    
    print(f"Loading boundaries from {boundary_path}")
    gdf = gpd.read_file(boundary_path)
    
    # Calculate Area and Centroid
    # Reproject to UTM 43N for metric calculations
    gdf_utm = gdf.to_crs(epsg=32643)
    
    gdf['area_sqkm'] = gdf_utm.geometry.area / 1e6
    gdf['centroid_lat'] = gdf.geometry.centroid.y
    gdf['centroid_lon'] = gdf.geometry.centroid.x
    
    print(f"Extracting DEM zonal statistics from {dem_path}")
    # Extract statistics using rasterstats
    # rasterstats will reproject on the fly if needed, but since DEM is EPSG:4326 and gdf is EPSG:4326, it's perfect.
    
    def calculate_percentiles(x):
        if x.mask.all():
            return {'p10': np.nan, 'p50': np.nan, 'p90': np.nan}
        return {
            'p10': np.percentile(x.compressed(), 10),
            'p50': np.percentile(x.compressed(), 50),
            'p90': np.percentile(x.compressed(), 90)
        }
        
    stats = zonal_stats(
        gdf, 
        dem_path, 
        stats=['min', 'max', 'mean', 'std'],
        add_stats={'custom_percentiles': calculate_percentiles},
        nodata=np.nan
    )
    
    # Unpack stats
    for i, stat in enumerate(stats):
        gdf.loc[i, 'elevation_min'] = stat.get('min')
        gdf.loc[i, 'elevation_max'] = stat.get('max')
        gdf.loc[i, 'elevation_mean'] = stat.get('mean')
        gdf.loc[i, 'elevation_std'] = stat.get('std')
        
        custom = stat.get('custom_percentiles', {})
        if custom:
            gdf.loc[i, 'elevation_p10'] = custom.get('p10')
            gdf.loc[i, 'elevation_p50'] = custom.get('p50')
            gdf.loc[i, 'elevation_p90'] = custom.get('p90')
        else:
            gdf.loc[i, 'elevation_p10'] = np.nan
            gdf.loc[i, 'elevation_p50'] = np.nan
            gdf.loc[i, 'elevation_p90'] = np.nan
            
    # Retain required columns
    # We want: GP identifier (GPCODE), GP name (GPNAME), block (blkname), district (dtname), geometry reference, area, centroid, elevation statistics
    retain_cols = [
        'GPCODE', 'GPNAME', 'blkname', 'dtname',
        'area_sqkm', 'centroid_lat', 'centroid_lon',
        'elevation_min', 'elevation_max', 'elevation_mean', 
        'elevation_std', 'elevation_p10', 'elevation_p50', 'elevation_p90'
    ]
    
    # Note: we drop the physical geometry vector for the Parquet feature table to save space, but retain the identifiers.
    df = pd.DataFrame(gdf.drop(columns=['geometry']))
    # Just in case some columns are missing
    cols_to_keep = [c for c in retain_cols if c in df.columns]
    df_features = df[cols_to_keep].copy()
    
    out_dir = os.path.join(base, "data", "processed", "features")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "panchayat_static_features.parquet")
    
    df_features.to_parquet(out_path, index=False)
    print(f"Saved {len(df_features)} records to {out_path}")

if __name__ == "__main__":
    extract_dem_features()
