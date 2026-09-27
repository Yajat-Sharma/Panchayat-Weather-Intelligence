import matplotlib.pyplot as plt
import os
import geopandas as gpd
from shapely.geometry import Point

def plot_spatial_results(df, true_col='true_precip', coarse_col='coarse_true_precip', 
                         baseline_col='baseline_pred', ml_col='xgb_pred', 
                         output_path='artifacts/figures/spatial_results.png'):
                         
    # Ensure directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Needs to be a GeoDataFrame for easy plotting if it isn't already
    if not isinstance(df, gpd.GeoDataFrame):
        df = gpd.GeoDataFrame(df, geometry=gpd.points_from_xy(df.lon, df.lat), crs="EPSG:4326")
        
    fig, axes = plt.subplots(1, 5, figsize=(25, 5))
    
    # Find global min/max for consistent colorbars
    cols_to_plot = [true_col, coarse_col, baseline_col, ml_col]
    vmin = df[cols_to_plot].min().min()
    vmax = df[cols_to_plot].max().max()
    
    # 1. Original Fine Field
    df.plot(column=true_col, ax=axes[0], legend=True, vmin=vmin, vmax=vmax, cmap='viridis', markersize=50, marker='s')
    axes[0].set_title('Original High-Res Truth')
    
    # 2. Coarse Field
    df.plot(column=coarse_col, ax=axes[1], legend=True, vmin=vmin, vmax=vmax, cmap='viridis', markersize=50, marker='s')
    axes[1].set_title('Aggregated Coarse Field')
    
    # 3. Nearest-Neighbour Baseline
    df.plot(column=baseline_col, ax=axes[2], legend=True, vmin=vmin, vmax=vmax, cmap='viridis', markersize=50, marker='s')
    axes[2].set_title('Nearest-Neighbour Baseline')
    
    # 4. XGBoost Prediction
    df.plot(column=ml_col, ax=axes[3], legend=True, vmin=vmin, vmax=vmax, cmap='viridis', markersize=50, marker='s')
    axes[3].set_title('XGBoost Residual Prediction')
    
    # 5. Absolute Error Map
    df['abs_error'] = (df[ml_col] - df[true_col]).abs()
    df.plot(column='abs_error', ax=axes[4], legend=True, cmap='Reds', markersize=50, marker='s')
    axes[4].set_title('Absolute Error (XGBoost)')
    
    for ax in axes:
        ax.set_axis_off()
        
    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()
