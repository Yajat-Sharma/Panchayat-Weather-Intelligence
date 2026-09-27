# Phase 5 Preprocessing Report

## 1. ERA5 Coverage Constraint (Blocker)
The physical bounding box of the authoritative Pune Gram Panchayats extends between:
- **17.89°N – 19.39°N**
- **73.32°E – 75.16°E**

Our existing ERA5 crop (`era5_pune_2023.nc`) is bound by `18.0°N–19.5°N, 73.0°E–75.0°E`. 
Consequently, **31 Panchayats lie physically outside the available weather data.**

To enforce strict scientific validity and prevent data leakage or spatial holes, all weather-dependent preprocessing (ERA5 spatial joins, precipitation processing, temporal feature generation) has been **BLOCKED**. 

A new configuration file (`configs/study_area.yaml`) was created setting the required weather BBox to `[20.0, 72.5, 17.0, 75.5]` (including a 0.5° buffer). The ERA5 downloader (`ml/scripts/download_era5.py`) has been updated to use this config. The user must explicitly run the downloader to lift this blocker.

## 2. Panchayat Geometry Quality
The 1,545 Panchayats downloaded via the NIC Gram Manchitra REST service were audited:
- **Invalid/Empty Geometries:** 0
- **Duplicate Spatial Geometries:** 0
- **Extremely Small Polygons (<0.01 sq km):** 2 (Preserved as likely digitization artifacts along borders, without arbitrary deletion).
- **Duplicate GPCODE Identifiers:** 194 (Documented in `panchayat-reconciliation.md`. These represent administrative Panchayats that are geographically split into MultiPolygons).

All geometries were scientifically preserved. We buffered the geometries by 0 to ensure topological correctness and saved them to `data/interim/boundaries/pune_panchayats_valid.geojson`. The original file was kept immutable.

## 3. Administrative Count Reconciliation
The discrepancy between the official Zilla Parishad count (1,386) and the spatial geometry count (1,545) is formally logged in `docs/datasets/panchayat-reconciliation.md`. We enforce that the spatial layer is the actual physical ground truth for ML extraction.

## 4. DEM to Panchayat Features
Using `rasterstats`, we performed a rigorous zonal extraction against the 30m Copernicus GLO-30 DEM.
For every Panchayat polygon, we extracted:
- **Area** (calculated in EPSG:32643 UTM 43N metric projection)
- **Centroid Coordinates**
- **Elevation Zonal Statistics:** Min, Max, Mean, Std, P10, P50 (Median), P90.

The result is saved to: `data/processed/features/panchayat_static_features.parquet` (1,545 rows).

## 5. Fine Target Requirement
A rigorous methodology document (`docs/methodology/fine-target-requirements.md`) was established to formally reject ERA5 as the evaluation target. It dictates that an independent, higher-resolution dataset (like CHIRPS 0.05° or IMD 0.1°) must be selected in the next phase to evaluate the downscaling model realistically.

## 6. Testing
A comprehensive Pytest suite was authored (`ml/tests/test_preprocessing.py`). 
- Static geometry and DEM feature extraction tests pass (3/3).
- ERA5 spatial coverage and aggregation tests are explicitly **SKIPPED** due to the identified boundary mismatch. No tests were weakened or fabricated.
