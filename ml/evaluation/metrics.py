import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error
from scipy.stats import pearsonr

def calculate_metrics(y_true, y_pred):
    """Calculates standard regression metrics for weather evaluation."""
    # Ensure inputs are 1D arrays
    y_true = np.asarray(y_true).ravel()
    y_pred = np.asarray(y_pred).ravel()
    
    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    bias = np.mean(y_pred - y_true)
    
    # Handle edge case where standard deviation is zero (all predictions same)
    if np.std(y_true) > 0 and np.std(y_pred) > 0:
        correlation, _ = pearsonr(y_true, y_pred)
    else:
        correlation = np.nan
        
    return {
        'MAE': float(mae),
        'RMSE': float(rmse),
        'Bias': float(bias),
        'Correlation': float(correlation) if not np.isnan(correlation) else None
    }

def error_by_elevation(df, true_col, pred_col, elevation_col='elevation', quantiles=4):
    """Calculates error stratified by elevation quantiles."""
    df_copy = df.copy()
    df_copy['error'] = np.abs(df_copy[pred_col] - df_copy[true_col])
    
    # Create elevation bins
    df_copy['elev_bin'] = pd.qcut(df_copy[elevation_col], q=quantiles, duplicates='drop')
    
    stratified_error = df_copy.groupby('elev_bin')['error'].mean().reset_index()
    stratified_error.rename(columns={'error': 'MAE'}, inplace=True)
    # Convert Interval to string for JSON serialization
    stratified_error['elev_bin'] = stratified_error['elev_bin'].astype(str)
    return stratified_error.to_dict(orient='records')
