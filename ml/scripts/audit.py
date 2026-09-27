import pandas as pd
import numpy as np
from sklearn.metrics import mean_squared_error, mean_absolute_error
import xgboost as xgb
from sklearn.model_selection import train_test_split
import warnings
warnings.filterwarnings('ignore')

def run_audit():
    print("=== ROW COUNTS & DUPLICATES ===")
    df = pd.read_parquet('../data/processed/features/panchayat_downscaling_dataset.parquet')
    preds = pd.read_parquet('../data/processed/predictions/test_predictions.parquet')
    
    total_rows = len(df)
    unique_gps = df['GPCODE'].nunique()
    unique_dates = df['date'].nunique()
    
    print(f"Total rows in ML dataset: {total_rows}")
    print(f"Unique Panchayats: {unique_gps}")
    print(f"Unique dates: {unique_dates}")
    print(f"Expected conceptual rows (1545 x 365): {1545 * 365}")
    print(f"Expected rows after deduplication (1351 x 365): {1351 * 365}")
    print(f"Duplicate GPCODE-date pairs: {df.duplicated(subset=['GPCODE', 'date']).sum()}")
    
    print("\n=== METRIC RECALCULATION ===")
    y_true = preds['target_rainfall_mm']
    y_pred = preds['downscaled_rainfall_mm']
    y_base = preds['era5_rainfall_mm']
    
    rmse_base = np.sqrt(mean_squared_error(y_true, y_base))
    mae_base = mean_absolute_error(y_true, y_base)
    
    rmse_mod = np.sqrt(mean_squared_error(y_true, y_pred))
    mae_mod = mean_absolute_error(y_true, y_pred)
    
    rmse_imp = (rmse_base - rmse_mod) / rmse_base * 100
    
    print(f"ERA5 Baseline RMSE: {rmse_base:.4f}, MAE: {mae_base:.4f}")
    print(f"XGBoost Model RMSE: {rmse_mod:.4f}, MAE: {mae_mod:.4f}")
    print(f"Absolute RMSE Reduction: {rmse_base - rmse_mod:.4f}")
    print(f"Percentage RMSE Reduction: {rmse_imp:.4f}%")
    
    bias = np.mean(y_pred - y_true)
    print(f"Bias (Model - Truth): {bias:.4f}")
    
    print("\n=== RAINFALL DISTRIBUTION ===")
    print(f"Total test observations: {len(preds)}")
    print(f"Dry days (target == 0): {(y_true == 0).sum()}")
    print(f"Rainy days (target > 0): {(y_true > 0).sum()}")
    print(f"Median: {y_true.median():.4f}")
    print(f"Mean: {y_true.mean():.4f}")
    print(f"P90: {y_true.quantile(0.90):.4f}")
    print(f"P95: {y_true.quantile(0.95):.4f}")
    print(f"Max: {y_true.max():.4f}")
    
    print("\n=== ERROR BY INTENSITY ===")
    bins = [
        ('Zero (0 mm)', y_true == 0),
        ('Light (0-10 mm]', (y_true > 0) & (y_true <= 10)),
        ('Moderate (10-50 mm]', (y_true > 10) & (y_true <= 50)),
        ('Heavy (>50 mm)', y_true > 50)
    ]
    
    for name, mask in bins:
        if mask.sum() > 0:
            sub_true = y_true[mask]
            sub_pred = y_pred[mask]
            sub_base = y_base[mask]
            
            rmse_b = np.sqrt(mean_squared_error(sub_true, sub_base))
            rmse_m = np.sqrt(mean_squared_error(sub_true, sub_pred))
            
            print(f"{name}: N={mask.sum()}, ERA5 RMSE={rmse_b:.2f}, XGB RMSE={rmse_m:.2f}")
            
    print("\n=== ERROR BY ELEVATION ===")
    # Join predictions with static features for elevation
    static = pd.read_parquet('../data/processed/features/panchayat_static_features.parquet').drop_duplicates('GPCODE')
    preds_elev = preds.merge(static[['GPCODE', 'elevation_mean']], on='GPCODE', how='inner')
    
    elev_bins = [
        ('Low (<500m)', preds_elev['elevation_mean'] < 500),
        ('Mid (500-800m)', (preds_elev['elevation_mean'] >= 500) & (preds_elev['elevation_mean'] <= 800)),
        ('High (>800m)', preds_elev['elevation_mean'] > 800)
    ]
    for name, mask in elev_bins:
        if mask.sum() > 0:
            sub_true = preds_elev.loc[mask, 'target_rainfall_mm']
            sub_pred = preds_elev.loc[mask, 'downscaled_rainfall_mm']
            sub_base = preds_elev.loc[mask, 'era5_rainfall_mm']
            rmse_b = np.sqrt(mean_squared_error(sub_true, sub_base))
            rmse_m = np.sqrt(mean_squared_error(sub_true, sub_pred))
            print(f"{name}: N={mask.sum()}, ERA5 RMSE={rmse_b:.2f}, XGB RMSE={rmse_m:.2f}")
            
    print("\n=== IN-MEMORY FEATURE IMPORTANCE ===")
    # We retrain exactly identical model in memory to get feature importance since it wasn't saved
    unique_gpcodes = list(df['GPCODE'].unique())
    train_gpcodes, test_gpcodes = train_test_split(unique_gpcodes, test_size=0.2, random_state=42)
    train_df = df[df['GPCODE'].isin(train_gpcodes)]
    features = [
        'era5_rainfall_mm',
        'elevation_min', 'elevation_max', 'elevation_mean', 'elevation_std',
        'elevation_p10', 'elevation_p50', 'elevation_p90',
        'area_sqkm', 'centroid_lat', 'centroid_lon',
        'day_of_year', 'month'
    ]
    X_train = train_df[features]
    y_train = train_df['residual_rainfall_mm']
    model = xgb.XGBRegressor(n_estimators=100, learning_rate=0.1, max_depth=6, random_state=42, n_jobs=-1)
    model.fit(X_train, y_train)
    
    imp = model.feature_importances_
    fi = sorted(zip(features, imp), key=lambda x: x[1], reverse=True)
    for f, i in fi:
        print(f"{f}: {i:.4f}")

if __name__ == '__main__':
    run_audit()
