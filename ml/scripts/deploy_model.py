import pandas as pd
import numpy as np
import os
import xgboost as xgb
import warnings

warnings.filterwarnings('ignore')

def main():
    print("Loading full dataset for production deployment...")
    # Production model uses ALL available data to maximize learned relationships
    df = pd.read_parquet('../data/processed/features/panchayat_downscaling_dataset.parquet')
    
    features = [
        'era5_rainfall_mm',
        'elevation_min', 'elevation_max', 'elevation_mean', 'elevation_std',
        'elevation_p10', 'elevation_p50', 'elevation_p90',
        'area_sqkm', 'centroid_lat', 'centroid_lon',
        'day_of_year', 'month'
    ]
    
    X_train = df[features]
    y_train = df['residual_rainfall_mm']
    
    print(f"Training final Production XGBoost model on {len(df)} rows...")
    model = xgb.XGBRegressor(
        n_estimators=100, 
        learning_rate=0.1, 
        max_depth=6, 
        random_state=42, 
        n_jobs=-1
    )
    model.fit(X_train, y_train)
    
    # Save the model
    os.makedirs('../data/models', exist_ok=True)
    model_path = '../data/models/xgboost_downscaler.json'
    model.save_model(model_path)
    
    # Save the metadata
    metadata = {
        "model_version": "xgboost_downscaler_v1",
        "training_dataset": "panchayat_downscaling_dataset.parquet (Full 2023 ERA5/CHIRPS)",
        "training_period": "2023-01-01 to 2023-12-31",
        "feature_schema_version": "1.0",
        "feature_order": features,
        "baseline_method": "ERA5 Representative Centroid Interpolation",
        "xgboost_parameters": {
            "n_estimators": 100,
            "learning_rate": 0.1,
            "max_depth": 6,
            "random_state": 42
        },
        "validation_evidence": "Phase 6.2 Spatial-Block Cross-Validation (K=5) on physically isolated regions.",
        "created_at": pd.Timestamp.now(tz='UTC').isoformat()
    }
    
    import json
    metadata_path = '../data/models/xgboost_downscaler_metadata.json'
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=4)
    
    print(f"Deployment model successfully serialized to: {model_path}")
    print(f"Deployment metadata successfully serialized to: {metadata_path}")

if __name__ == '__main__':
    main()
