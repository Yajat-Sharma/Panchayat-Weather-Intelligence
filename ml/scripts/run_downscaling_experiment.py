import os
import pandas as pd
import numpy as np
import logging
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, mean_absolute_error
import xgboost as xgb
import json

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def get_base_dir():
    return Path(__file__).resolve().parent.parent.parent

def calculate_metrics(y_true, y_pred, y_baseline, threshold=2.5):
    mse_model = mean_squared_error(y_true, y_pred)
    rmse_model = np.sqrt(mse_model)
    mae_model = mean_absolute_error(y_true, y_pred)
    
    mse_baseline = mean_squared_error(y_true, y_baseline)
    rmse_baseline = np.sqrt(mse_baseline)
    mae_baseline = mean_absolute_error(y_true, y_baseline)
    
    # Event metrics
    event_true = y_true >= threshold
    event_pred = y_pred >= threshold
    
    hits = np.sum(event_true & event_pred)
    misses = np.sum(event_true & ~event_pred)
    false_alarms = np.sum(~event_true & event_pred)
    
    pod = hits / (hits + misses) if (hits + misses) > 0 else 0
    far = false_alarms / (hits + false_alarms) if (hits + false_alarms) > 0 else 0
    csi = hits / (hits + misses + false_alarms) if (hits + misses + false_alarms) > 0 else 0
    
    return {
        "rmse_model": rmse_model,
        "mae_model": mae_model,
        "rmse_baseline": rmse_baseline,
        "mae_baseline": mae_baseline,
        "rmse_improvement_pct": ((rmse_baseline - rmse_model) / rmse_baseline) * 100 if rmse_baseline > 0 else 0,
        "pod": pod,
        "far": far,
        "csi": csi
    }

def run_experiment():
    base_dir = get_base_dir()
    
    dataset_path = base_dir / "data" / "processed" / "features" / "panchayat_downscaling_dataset.parquet"
    output_dir = base_dir / "data" / "processed" / "predictions"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    logger.info(f"Loading dataset from {dataset_path}...")
    df = pd.read_parquet(dataset_path)
    
    # Fill NAs in static features (like elevation_p10, etc if any)
    df = df.fillna(0)
    
    # We want to do a spatial split. 
    # This prevents the model from just memorizing the location.
    unique_gpcodes = list(df['GPCODE'].unique())
    train_gpcodes, test_gpcodes = train_test_split(unique_gpcodes, test_size=0.2, random_state=42)
    
    train_df = df[df['GPCODE'].isin(train_gpcodes)]
    test_df = df[df['GPCODE'].isin(test_gpcodes)]
    
    logger.info(f"Train size: {len(train_df)} (from {len(train_gpcodes)} GPs)")
    logger.info(f"Test size: {len(test_df)} (from {len(test_gpcodes)} GPs)")
    
    # Features
    features = [
        'era5_rainfall_mm',
        'elevation_min', 'elevation_max', 'elevation_mean', 'elevation_std',
        'elevation_p10', 'elevation_p50', 'elevation_p90',
        'area_sqkm', 'centroid_lat', 'centroid_lon',
        'day_of_year', 'month'
    ]
    
    target = 'residual_rainfall_mm'
    
    X_train = train_df[features]
    y_train = train_df[target]
    
    X_test = test_df[features]
    y_test = test_df[target]
    
    logger.info("Training XGBoost Regressor...")
    model = xgb.XGBRegressor(
        n_estimators=100,
        learning_rate=0.1,
        max_depth=6,
        random_state=42,
        n_jobs=-1
    )
    
    model.fit(X_train, y_train)
    
    logger.info("Predicting on test set...")
    test_df['predicted_residual'] = model.predict(X_test)
    test_df['downscaled_rainfall_mm'] = test_df['era5_rainfall_mm'] + test_df['predicted_residual']
    
    # Ensure no negative rainfall
    test_df['downscaled_rainfall_mm'] = test_df['downscaled_rainfall_mm'].clip(lower=0)
    
    # Calculate metrics
    metrics = calculate_metrics(
        y_true=test_df['target_rainfall_mm'],
        y_pred=test_df['downscaled_rainfall_mm'],
        y_baseline=test_df['era5_rainfall_mm']
    )
    
    logger.info("--- METRICS ---")
    for k, v in metrics.items():
        logger.info(f"{k}: {v:.4f}")
        
    metrics_path = output_dir / "metrics.json"
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=4)
        
    # Save predictions
    test_df[['GPCODE', 'date', 'era5_rainfall_mm', 'target_rainfall_mm', 'downscaled_rainfall_mm']].to_parquet(
        output_dir / "test_predictions.parquet", index=False
    )
    logger.info("Saved metrics and predictions.")

if __name__ == "__main__":
    run_experiment()
