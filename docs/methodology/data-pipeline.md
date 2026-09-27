# Data Pipeline & Preprocessing

The `ml/preprocessing` module handles the transformation of raw geographic and meteorological data into reproducible tabular features ready for ML downscaling.

## 1. CRS Normalization
Geospatial files (Shapefiles, GeoJSONs, NetCDFs, TIFs) often arrive in diverse Coordinate Reference Systems (CRS). 
The `validate_crs()` function guarantees all geometries are converted to `EPSG:4326` (Lat/Lon) for standardized database storage. Whenever distances or areas (e.g., polygon area, distances to AWS stations) need to be calculated, geometries are temporarily projected to an equal-area or appropriate UTM projection (e.g., `EPSG:32643` for Maharashtra).

## 2. Spatial Processing & Terrain Extraction
Using `rasterio.mask`, we overlay the high-resolution DEM (30m) onto the Panchayat vector boundaries.
For each Panchayat, we extract:
- `elevation_mean`
- `elevation_min`
- `elevation_max`
- `elevation_std`

## 3. Coarse -> Fine Experiment
To validate our downscaling methodology before acquiring official real-time low-resolution forecasts, we conduct a controlled experiment:
1. Acquire a high-resolution historical gridded observation (e.g., 5km grid).
2. Artificially aggregate this data using a block-mean to a coarse grid (e.g., 25km).
3. Feed the 25km coarse data into the downscaling model.
4. Evaluate the model's high-res output against the original 5km observations.
This scientifically demonstrates the ML model's ability to learn topographic residual corrections.

## 4. Feature Extraction & Storage
The final dataset combines:
- Normalized Panchayat metadata (ID, block_id, centroid coordinates, area)
- Extracted terrain statistics
This table is deterministic and saved in `.parquet` format within `data/processed/` for lightning-fast loading by the XGBoost training pipeline.

## 5. What We Can Currently Prove
- The interpolation baselines (Nearest Neighbor, Bilinear) correctly transfer coarse data to Panchayat centroids.
- Our geometry and CRS handling accurately computes spatial boundaries and extracts corresponding raster pixels.
- The pipeline correctly splits data temporally and spatially to prevent data leakage during ML evaluation.

## What Remains to be Validated
- The XGBoost residual model's improvement over the baseline interpolation methods on real-world Indian meteorological data.
