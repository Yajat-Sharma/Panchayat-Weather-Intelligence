# Downscaling Methodology

## 1. Problem Formulation
The objective of this pipeline is to downscale coarse-resolution numerical weather predictions (e.g., ERA5 ~27km) to high-resolution geospatial boundaries (Gram Panchayats ~30m DEM). 

## 2. Model Equation
We employ a **residual correction downscaling** approach. The machine learning model (XGBoost) does not predict absolute precipitation directly. Instead, it predicts the localized discrepancy (residual) between the coarse prediction and the fine-resolution reference.

**Training Equation:**
`residual = CHIRPS_reference_rainfall_mm - ERA5_baseline_rainfall_mm`

**Prediction Equation:**
`prediction = ERA5_baseline_rainfall_mm + predicted_residual`

By predicting the residual, the model acts as a physical modifier that learns how local terrain (elevation, slopes) and geometry systematically bias or enhance the large-scale atmospheric forcing provided by ERA5.

## 3. Spatial Aggregation
- **ERA5 Coarse Input:** Extracted using nearest-neighbor indexing for the geographic centroid of each Gram Panchayat ("Panchayat representative-point sampling").
- **CHIRPS Reference Target:** Extracted using nearest-neighbor indexing for the geographic centroid of each Gram Panchayat ("Panchayat representative-point sampling").

## 4. Validation Strategy
- **Random Spatial Holdout (Phase 6.1):** 20% random holdout of Panchayats. Useful for establishing baseline feasibility (54.3% RMSE reduction). Susceptible to spatial autocorrelation.
- **Geographic K-Means Spatial Block Validation (Phase 6.2):** K=5 clustering on physical centroids. Strict out-of-fold generalization test on macroscopic regions. Proves true geographic generalization (38.45% pooled RMSE reduction).

## 5. Leakage Audit
- **Temporal Leakage:** **PASS**. All temporal features (Day of Year) do not contain target-derived information. No moving averages or future interpolations are used.
- **Feature Leakage:** **PASS**. The residual is used strictly as the `y_train` target during model fitting. It is not fed back into the feature space (`X_train`). No target-derived metrics (climatologies of the target) are used as predictors.
- **Spatial Leakage:** **PASS**. By utilizing the K-Means geographic spatial block validation (Phase 6.2), neighbors are grouped into identical folds, preventing spatial autocorrelation interpolation.
- **Feature Classification:**
  - `era5_rainfall_mm`: COARSE WEATHER
  - `elevation_min`, `elevation_max`, `elevation_mean`, `elevation_std`, `elevation_p10`, `elevation_p50`, `elevation_p90`: TERRAIN
  - `area_sqkm`, `centroid_lat`, `centroid_lon`: SPATIAL
  - `day_of_year`, `month`: TEMPORAL
  - No feature is classified as TARGET-DERIVED.
