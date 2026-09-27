import os
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

def get_base_dir():
    return Path(__file__).resolve().parent.parent.parent

def extract_era5_to_panchayats():
    base_dir = get_base_dir()
    
    geojson_path = base_dir / "data" / "interim" / "boundaries" / "pune_panchayats_valid.geojson"
    era5_nc_path = base_dir / "data" / "raw" / "weather" / "era5_pune_2023.nc"
    output_dir = base_dir / "data" / "processed" / "weather"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / "panchayat_era5_weather.parquet"
    
    logger.info("Loading Panchayats...")
    gdf = gpd.read_file(geojson_path)
    
    if gdf.crs != "EPSG:4326":
        gdf = gdf.to_crs("EPSG:4326")
        
    logger.info("Calculating Centroids...")
    centroids = gdf.geometry.centroid
    gdf['centroid_lon'] = centroids.x
    gdf['centroid_lat'] = centroids.y
    
    logger.info(f"Loading ERA5 from {era5_nc_path}...")
    ds = xr.open_dataset(era5_nc_path)
    
    if 'tp' not in ds.variables:
        raise ValueError("Total precipitation ('tp') not found in ERA5 dataset.")
        
    precip = ds['tp']
    
    logger.info("Processing hourly/daily precipitation...")
    if len(precip.valid_time) > 366:
        logger.info("ERA5 is hourly. Resampling to daily sum...")
        precip_daily = precip.resample(valid_time="1D").sum().compute()
    else:
        precip_daily = precip.compute()

    logger.info("Extracting nearest ERA5 pixels for all Panchayats (Vectorized)...")
    
    # We can select points directly using xarray advanced indexing
    lats = xr.DataArray(gdf['centroid_lat'].values, dims="location")
    lons = xr.DataArray(gdf['centroid_lon'].values, dims="location")
    
    # Select nearest grid cells for all locations at once
    extracted = precip_daily.sel(latitude=lats, longitude=lons, method="nearest")
    
    # extracted shape is (time, location)
    logger.info("Building DataFrame...")
    
    times = pd.to_datetime(extracted.valid_time.values)
    gpcodes = gdf['GPCODE'].values
    
    records = []
    
    # ERA5 is in meters, convert to mm
    data_mm = extracted.values * 1000.0
    
    for i, time in enumerate(times):
        date_str = time.strftime('%Y-%m-%d')
        # data_mm[i] has length of locations (1545)
        for j, gpcode in enumerate(gpcodes):
            if pd.notna(gpcode):
                records.append({
                    "GPCODE": gpcode,
                    "date": date_str,
                    "era5_rainfall_mm": data_mm[i, j]
                })
                
    logger.info("Creating dataframe...")
    df = pd.DataFrame(records)
    
    logger.info(f"Saving to {output_path}...")
    df.to_parquet(output_path, index=False)
    
    logger.info(f"Done! Created {len(df)} records.")
    
if __name__ == "__main__":
    extract_era5_to_panchayats()
