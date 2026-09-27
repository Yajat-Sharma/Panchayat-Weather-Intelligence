import os
import pandas as pd
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def get_base_dir():
    return Path(__file__).resolve().parent.parent.parent

def build_dataset():
    base_dir = get_base_dir()
    
    # Paths
    static_features_path = base_dir / "data" / "processed" / "features" / "panchayat_static_features.parquet"
    weather_features_path = base_dir / "data" / "processed" / "weather" / "panchayat_era5_weather.parquet"
    target_path = base_dir / "data" / "processed" / "targets" / "panchayat_rainfall_target.parquet"
    
    output_dir = base_dir / "data" / "processed" / "features"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / "panchayat_downscaling_dataset.parquet"
    
    logger.info("Loading Static Features...")
    df_static = pd.read_parquet(static_features_path)
    
    logger.info("Loading ERA5 Weather Features...")
    df_weather = pd.read_parquet(weather_features_path)
    
    logger.info("Loading CHIRPS Target...")
    df_target = pd.read_parquet(target_path)
    
    logger.info("Normalizing GPCODE types...")
    df_static['GPCODE'] = df_static['GPCODE'].astype(str)
    df_weather['GPCODE'] = df_weather['GPCODE'].astype(str)
    df_target['GPCODE'] = df_target['GPCODE'].astype(str)
    
    logger.info("Dropping duplicates to prevent Cartesian explosion...")
    df_static = df_static.drop_duplicates(subset=["GPCODE"])
    df_weather = df_weather.drop_duplicates(subset=["GPCODE", "date"])
    df_target = df_target.drop_duplicates(subset=["GPCODE", "date"])
    
    logger.info("Merging datasets...")
    # First merge weather and static (weather has date and GPCODE, static has GPCODE)
    df = pd.merge(df_weather, df_static, on="GPCODE", how="inner")
    
    # Then merge target (target has date and GPCODE)
    df = pd.merge(df, df_target, on=["GPCODE", "date"], how="inner")
    
    logger.info("Adding temporal features...")
    df['date'] = pd.to_datetime(df['date'])
    df['day_of_year'] = df['date'].dt.dayofyear
    df['month'] = df['date'].dt.month
    
    logger.info("Calculating Baseline Residual...")
    # Target = ERA5 + Residual => Residual = Target - ERA5
    # The XGBoost model will predict the residual
    df['residual_rainfall_mm'] = df['target_rainfall_mm'] - df['era5_rainfall_mm']
    
    logger.info(f"Saving merged dataset to {output_path}...")
    df.to_parquet(output_path, index=False)
    
    logger.info(f"Done! Created {len(df)} records. ({len(df['GPCODE'].unique())} Panchayats * {len(df['date'].unique())} Days)")

if __name__ == "__main__":
    build_dataset()
