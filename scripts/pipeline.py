import argparse
import sys
import os
import pandas as pd
import json

def inspect_weather(args):
    print(f"Inspecting weather file: {args.file}")
    try:
        import xarray as xr
        ds = xr.open_dataset(args.file)
        print("\n--- NetCDF Metadata ---")
        print("Dimensions:", dict(ds.sizes))
        print("\nCoordinates:")
        for coord in ds.coords:
            print(f"  - {coord}: {ds.coords[coord].dtype} (size {ds.coords[coord].size})")
        print("\nData Variables:")
        for var in ds.data_vars:
            attrs = ds[var].attrs
            units = attrs.get('units', 'Unknown')
            long_name = attrs.get('long_name', 'Unknown')
            print(f"  - {var}: {long_name} [{units}]")
        print("\nSpatial Extent:")
        # Try to infer lat/lon
        lat_names = ['latitude', 'lat']
        lon_names = ['longitude', 'lon']
        lat_coord = next((c for c in lat_names if c in ds.coords), None)
        lon_coord = next((c for c in lon_names if c in ds.coords), None)
        if lat_coord and lon_coord:
            print(f"  Lat: {ds[lat_coord].min().values:.4f} to {ds[lat_coord].max().values:.4f}")
            print(f"  Lon: {ds[lon_coord].min().values:.4f} to {ds[lon_coord].max().values:.4f}")
            if len(ds[lat_coord]) > 1:
                print(f"  Approx Lat Res: {abs(ds[lat_coord][1].values - ds[lat_coord][0].values):.4f} deg")
        print("\nTemporal Coverage:")
        if 'time' in ds.coords:
            print(f"  Time: {ds['time'].min().values} to {ds['time'].max().values}")
        ds.close()
    except Exception as e:
        print(f"ERROR: Failed to inspect NetCDF: {e}")

def inspect_boundaries(args):
    print(f"Inspecting boundaries file: {args.file}")
    try:
        import geopandas as gpd
        gdf = gpd.read_file(args.file)
        print("\n--- Boundary Metadata ---")
        print(f"Features (Polygons): {len(gdf)}")
        print(f"CRS: {gdf.crs}")
        print(f"Columns: {list(gdf.columns)}")
        print(f"Geometry Types: {gdf.geom_type.unique()}")
        bounds = gdf.total_bounds
        print(f"Bounding Box: Min(Lon,Lat)={bounds[0]:.4f},{bounds[1]:.4f} | Max(Lon,Lat)={bounds[2]:.4f},{bounds[3]:.4f}")
        invalid = sum(~gdf.is_valid)
        if invalid > 0:
            print(f"WARNING: {invalid} invalid geometries found!")
    except Exception as e:
        print(f"ERROR: Failed to inspect boundaries: {e}")

def inspect_dem(args):
    print(f"Inspecting DEM file: {args.file}")
    try:
        import rasterio
        with rasterio.open(args.file) as src:
            print("\n--- DEM Metadata ---")
            print(f"CRS: {src.crs}")
            print(f"Resolution: {src.res}")
            print(f"Bounds: {src.bounds}")
            print(f"Width/Height: {src.width}x{src.height}")
            print(f"NoData Value: {src.nodata}")
            print(f"Data Type: {src.dtypes[0]}")
    except Exception as e:
        print(f"ERROR: Failed to inspect DEM: {e}")

def prepare_boundaries(args):
    print("Preparing boundaries... (placeholder)")
    print(f"Input: {args.input}, Output: {args.output}")

def extract_terrain(args):
    print("Extracting terrain features... (placeholder)")

def run_baseline(args):
    print("Running baseline... (placeholder)")

def evaluate(args):
    print("Evaluating baseline against ground truth... (placeholder)")

def run_experiment(args):
    print("Running controlled downscaling experiment...")
    # Import here to avoid loading heavy ML libs for other commands
    from ml.experiments.aggregation import SyntheticDataGenerator, SpatialAggregator
    from ml.features.builder import FeatureBuilder
    from ml.baselines.spatial_interpolation import NearestNeighborBaseline
    from ml.models.xgboost_residual import XGBoostResidualDownscaler
    from ml.evaluation.metrics import calculate_metrics, error_by_elevation
    from ml.evaluation.plots import plot_spatial_results
    from ml.experiments.tracker import ExperimentTracker
    from ml.evaluation.splits import temporal_split
    import pandas as pd
    import os

    # 1. Generate Synthetic Truth
    print("1. Generating synthetic high-resolution data...")
    bounds = (73.0, 18.0, 75.0, 20.0)
    dates = pd.date_range(start="2023-01-01", end="2023-12-31", freq='D')
    gen = SyntheticDataGenerator(bounds, fine_resolution_deg=0.05)
    fine_gdf = gen.generate_historical_field(dates)
    
    # 2. Aggregation
    print("2. Aggregating to coarse field...")
    agg = SpatialAggregator(aggregation_factor=5)
    coarse_gdf = agg.aggregate(fine_gdf, variable='true_precip')
    
    # 3. Feature Building
    print("3. Building features...")
    builder = FeatureBuilder()
    X, Y, merged_df = builder.build(fine_gdf, coarse_gdf, variable='true_precip')
    
    # Add to DataFrame for splitting
    full_df = merged_df.copy()
    for col in X.columns:
        full_df[col] = X[col]
        
    # 4. Strict Temporal Split
    print("4. Splitting data temporally...")
    train_df, test_df = temporal_split(full_df, split_date='2023-10-01')
    
    X_train = train_df[X.columns]
    Y_train = train_df['true_precip']
    X_test = test_df[X.columns]
    Y_test = test_df['true_precip']
    
    # 5. Baselines
    print("5. Running Baselines...")
    # For Nearest Neighbor, we need source points (coarse) and target polygons/points (fine)
    # We will approximate this for the DataFrame directly here using coarse_val for simplicity in the experiment, 
    # since coarse_val is exactly the block mean at that location.
    # A true NN would map from coarse centroids to fine centroids.
    # Because coarse_val is already joined to each fine point based on its block, it acts as a "block-nearest" baseline.
    baseline_train = X_train['coarse_val']
    baseline_test = X_test['coarse_val']
    
    # 6. XGBoost Residual
    print("6. Training XGBoost Residual model...")
    xgb_model = XGBoostResidualDownscaler()
    xgb_model.fit(X_train, Y_train, baseline_train)
    
    xgb_preds = xgb_model.predict(X_test, baseline_test)
    
    # Save predictions back to test_df for plotting
    test_df['baseline_pred'] = baseline_test
    test_df['xgb_pred'] = xgb_preds
    
    # 7. Metrics & Tracking
    print("7. Calculating Metrics...")
    base_metrics = calculate_metrics(Y_test, baseline_test)
    xgb_metrics = calculate_metrics(Y_test, xgb_preds)
    
    elev_errors = error_by_elevation(test_df, true_col='true_precip', pred_col='xgb_pred')
    
    tracker = ExperimentTracker()
    tracker.log_experiment({
        "config": args.config if args.config else "synthetic_default",
        "dataset": "synthetic_5km_to_25km",
        "variable": "precipitation",
        "train_samples": len(train_df),
        "test_samples": len(test_df),
        "baseline_metrics": base_metrics,
        "xgboost_metrics": xgb_metrics,
        "error_by_elevation": elev_errors,
        "feature_importance": xgb_model.feature_importances(list(X.columns))
    })
    
    print("\n--- RESULTS ---")
    print(f"Baseline (Coarse/Block): RMSE={base_metrics['RMSE']:.2f}, MAE={base_metrics['MAE']:.2f}")
    print(f"XGBoost Residual:        RMSE={xgb_metrics['RMSE']:.2f}, MAE={xgb_metrics['MAE']:.2f}")
    
    # 8. Visualization
    print("8. Generating visual map for the latest test date...")
    latest_date = test_df['valid_time'].max()
    plot_df = test_df[test_df['valid_time'] == latest_date].copy()
    os.makedirs('artifacts/figures', exist_ok=True)
    plot_spatial_results(plot_df, output_path=f'artifacts/figures/experiment_map_{latest_date.date()}.png')
    print("Experiment complete. Artifacts saved.")

def main():
    parser = argparse.ArgumentParser(description="SIH Weather Downscaling Pipeline")
    subparsers = parser.add_subparsers(dest="command", required=True)
    
    # Boundary prep
    parser_prep = subparsers.add_parser("prepare-boundaries", help="Clean and validate Panchayat boundaries.")
    parser_prep.add_argument("--input", required=True, help="Raw shapefile/geojson")
    parser_prep.add_argument("--output", required=True, help="Processed parquet file")
    
    # Terrain
    parser_terrain = subparsers.add_parser("extract-terrain", help="Extract DEM statistics.")
    parser_terrain.add_argument("--boundaries", required=True)
    parser_terrain.add_argument("--dem", required=True)
    parser_terrain.add_argument("--output", required=True)

    # Baseline
    parser_baseline = subparsers.add_parser("run-baseline", help="Run a baseline downscaling model.")
    parser_baseline.add_argument("--coarse", required=True)
    parser_baseline.add_argument("--boundaries", required=True)
    parser_baseline.add_argument("--output", required=True)
    
    # Experiment
    parser_exp = subparsers.add_parser("run-experiment", help="Run the historical reconstruction experiment.")
    parser_exp.add_argument("--config", help="Path to experiment config YAML")
    
    # Inspectors
    parser_iw = subparsers.add_parser("inspect-weather", help="Inspect NetCDF weather data metadata.")
    parser_iw.add_argument("--file", required=True, help="Path to NetCDF file")
    
    parser_ib = subparsers.add_parser("inspect-boundaries", help="Inspect Panchayat boundary vector data.")
    parser_ib.add_argument("--file", required=True, help="Path to boundary shapefile/geojson")
    
    parser_id = subparsers.add_parser("inspect-dem", help="Inspect DEM raster data.")
    parser_id.add_argument("--file", required=True, help="Path to DEM GeoTIFF")
    
    args = parser.parse_args()
    
    if args.command == "prepare-boundaries":
        prepare_boundaries(args)
    elif args.command == "extract-terrain":
        extract_terrain(args)
    elif args.command == "run-baseline":
        run_baseline(args)
    elif args.command == "run-experiment":
        run_experiment(args)
    elif args.command == "inspect-weather":
        inspect_weather(args)
    elif args.command == "inspect-boundaries":
        inspect_boundaries(args)
    elif args.command == "inspect-dem":
        inspect_dem(args)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
