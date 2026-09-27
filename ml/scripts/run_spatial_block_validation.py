import pandas as pd
import numpy as np
import os
import json
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans
from sklearn.metrics import mean_squared_error, mean_absolute_error
import xgboost as xgb
import warnings

warnings.filterwarnings('ignore')

def main():
    print("Loading dataset...")
    df = pd.read_parquet('../data/processed/features/panchayat_downscaling_dataset.parquet')
    
    # K-Means clustering on unique GP coordinates to define contiguous geographic blocks
    gps = df[['GPCODE', 'centroid_lat', 'centroid_lon']].drop_duplicates()
    kmeans = KMeans(n_clusters=5, random_state=42, n_init=10)
    gps['fold_id'] = kmeans.fit_predict(gps[['centroid_lat', 'centroid_lon']])
    
    # Merge fold assignments back
    df = df.merge(gps[['GPCODE', 'fold_id']], on='GPCODE', how='left')
    
    features = [
        'era5_rainfall_mm',
        'elevation_min', 'elevation_max', 'elevation_mean', 'elevation_std',
        'elevation_p10', 'elevation_p50', 'elevation_p90',
        'area_sqkm', 'centroid_lat', 'centroid_lon',
        'day_of_year', 'month'
    ]
    
    oof_predictions = []
    fold_metrics = {}
    
    print("Running Spatial Block Validation...")
    for fold in range(5):
        print(f"--- Fold {fold} ---")
        train_df = df[df['fold_id'] != fold]
        test_df = df[df['fold_id'] == fold]
        
        # Train
        X_train = train_df[features]
        y_train = train_df['residual_rainfall_mm']
        
        # Test
        X_test = test_df[features]
        y_test = test_df['residual_rainfall_mm']
        
        # Model (same as Phase 6.1)
        model = xgb.XGBRegressor(
            n_estimators=100, 
            learning_rate=0.1, 
            max_depth=6, 
            random_state=42, 
            n_jobs=-1
        )
        model.fit(X_train, y_train)
        
        # Predict
        predicted_residual = model.predict(X_test)
        
        # Final output formatting
        fold_oof = test_df[['GPCODE', 'date', 'centroid_lat', 'centroid_lon', 'fold_id', 'era5_rainfall_mm', 'target_rainfall_mm', 'residual_rainfall_mm']].copy()
        fold_oof['predicted_residual'] = predicted_residual
        fold_oof['downscaled_rainfall_mm'] = fold_oof['era5_rainfall_mm'] + predicted_residual
        
        # Bound predictions to 0
        fold_oof.loc[fold_oof['downscaled_rainfall_mm'] < 0, 'downscaled_rainfall_mm'] = 0
        
        oof_predictions.append(fold_oof)
        
        # Compute Fold Metrics
        y_true = fold_oof['target_rainfall_mm']
        y_pred = fold_oof['downscaled_rainfall_mm']
        y_base = fold_oof['era5_rainfall_mm']
        
        rmse_base = np.sqrt(mean_squared_error(y_true, y_base))
        mae_base = mean_absolute_error(y_true, y_base)
        rmse_mod = np.sqrt(mean_squared_error(y_true, y_pred))
        mae_mod = mean_absolute_error(y_true, y_pred)
        
        fold_metrics[f"Fold_{fold}"] = {
            "test_panchayats": int(test_df['GPCODE'].nunique()),
            "train_panchayats": int(train_df['GPCODE'].nunique()),
            "era5_rmse": float(rmse_base),
            "xgb_rmse": float(rmse_mod),
            "era5_mae": float(mae_base),
            "xgb_mae": float(mae_mod),
            "rmse_reduction_percent": float((rmse_base - rmse_mod) / rmse_base * 100)
        }
        
    # Concatenate all Out-of-fold predictions
    oof_df = pd.concat(oof_predictions, ignore_index=True)
    
    # Save OOF predictions
    os.makedirs('../data/processed/predictions', exist_ok=True)
    oof_df.to_parquet('../data/processed/predictions/spatial_block_oof_predictions.parquet', index=False)
    
    # Compute Pooled Metrics
    y_true_pool = oof_df['target_rainfall_mm']
    y_pred_pool = oof_df['downscaled_rainfall_mm']
    y_base_pool = oof_df['era5_rainfall_mm']
    
    rmse_base_pool = np.sqrt(mean_squared_error(y_true_pool, y_base_pool))
    mae_base_pool = mean_absolute_error(y_true_pool, y_base_pool)
    rmse_mod_pool = np.sqrt(mean_squared_error(y_true_pool, y_pred_pool))
    mae_mod_pool = mean_absolute_error(y_true_pool, y_pred_pool)
    
    pooled_metrics = {
        "era5_rmse": float(rmse_base_pool),
        "xgb_rmse": float(rmse_mod_pool),
        "era5_mae": float(mae_base_pool),
        "xgb_mae": float(mae_mod_pool),
        "absolute_rmse_reduction": float(rmse_base_pool - rmse_mod_pool),
        "absolute_mae_reduction": float(mae_base_pool - mae_mod_pool),
        "rmse_reduction_percent": float((rmse_base_pool - rmse_mod_pool) / rmse_base_pool * 100),
        "mae_reduction_percent": float((mae_base_pool - mae_mod_pool) / mae_base_pool * 100)
    }
    
    # Heavy Rainfall calculation
    heavy_mask = y_true_pool > 50
    heavy_true = y_true_pool[heavy_mask]
    heavy_pred = y_pred_pool[heavy_mask]
    heavy_base = y_base_pool[heavy_mask]
    
    if len(heavy_true) > 0:
        heavy_rmse_base = np.sqrt(mean_squared_error(heavy_true, heavy_base))
        heavy_rmse_mod = np.sqrt(mean_squared_error(heavy_true, heavy_pred))
        heavy_metrics = {
            "sample_count": int(len(heavy_true)),
            "era5_rmse": float(heavy_rmse_base),
            "xgb_rmse": float(heavy_rmse_mod)
        }
    else:
        heavy_metrics = {"sample_count": 0}

    final_metrics = {
        "folds": fold_metrics,
        "pooled": pooled_metrics,
        "heavy_rainfall": heavy_metrics
    }
    
    os.makedirs('../data/processed/validation', exist_ok=True)
    with open('../data/processed/validation/spatial_block_metrics.json', 'w') as f:
        json.dump(final_metrics, f, indent=4)
        
    print(f"Pooled RMSE Reduction: {pooled_metrics['rmse_reduction_percent']:.2f}%")
    
    # --- VISUALIZATIONS ---
    os.makedirs('../data/processed/validation/plots', exist_ok=True)
    
    # 1. Geographic map of folds
    plt.figure(figsize=(8, 8))
    scatter = plt.scatter(gps['centroid_lon'], gps['centroid_lat'], c=gps['fold_id'], cmap='Set1', alpha=0.6)
    plt.title("Spatial Block Validation (K-Means K=5)")
    plt.xlabel("Longitude")
    plt.ylabel("Latitude")
    plt.legend(*scatter.legend_elements(), title="Fold ID")
    plt.savefig('../data/processed/validation/plots/fold_map.png')
    plt.close()

if __name__ == '__main__':
    main()
