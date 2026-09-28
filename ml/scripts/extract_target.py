import os
import sys
import yaml
import logging
from pathlib import Path
import geopandas as gpd
import pandas as pd
import xarray as xr
import warnings

warnings.filterwarnings("ignore")
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from ml.downscaling.config import BOUNDARIES, CHIRPS_NC, RAIN_TARGET  # noqa: E402

def extract_chirps_to_panchayats():
    geojson_path = BOUNDARIES
    target_nc_path = CHIRPS_NC
    output_path = RAIN_TARGET
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    logger.info("Loading Panchayats...")
    gdf = gpd.read_file(geojson_path)
    
    if gdf.crs != "EPSG:4326":
        gdf = gdf.to_crs("EPSG:4326")
        
    logger.info("Calculating Centroids...")
    centroids = gdf.geometry.centroid
    gdf['centroid_lon'] = centroids.x
    gdf['centroid_lat'] = centroids.y
    
    logger.info(f"Loading CHIRPS from {target_nc_path}...")
    ds = xr.open_dataset(target_nc_path)
    
    precip = ds['precip']
    
    logger.info("Extracting nearest CHIRPS pixels for all Panchayats (Vectorized)...")
    
    lats = xr.DataArray(gdf['centroid_lat'].values, dims="location")
    lons = xr.DataArray(gdf['centroid_lon'].values, dims="location")
    
    extracted = precip.sel(latitude=lats, longitude=lons, method="nearest")
    
    logger.info("Building DataFrame...")
    
    times = pd.to_datetime(extracted.time.values)
    gpcodes = gdf['GPCODE'].values
    
    records = []
    data = extracted.values
    
    for i, time in enumerate(times):
        date_str = time.strftime('%Y-%m-%d')
        for j, gpcode in enumerate(gpcodes):
            if pd.notna(gpcode):
                val = data[i, j]
                # CHIRPS usually uses -9999 for missing
                if val < 0:
                    val = 0.0
                records.append({
                    "GPCODE": gpcode,
                    "date": date_str,
                    "target_rainfall_mm": float(val),
                    "source": "CHIRPS_v2.0_p05"
                })
                
    logger.info("Creating dataframe...")
    df = pd.DataFrame(records)
    
    logger.info(f"Saving to {output_path}...")
    df.to_parquet(output_path, index=False)
    
    logger.info(f"Done! Created {len(df)} records.")
    
if __name__ == "__main__":
    extract_chirps_to_panchayats()
