# Downscaling Methodology

## 1. The Core Challenge
A coarse weather forecast provides a single value (e.g., temperature) for a large grid (e.g., 25km x 25km). Within this grid, there are multiple Panchayats. Simply applying the coarse value to all Panchayats ignores microclimatic variations.

## 2. Approach: Residual Correction

### Step 1: Baseline Generation
Before applying complex ML, we generate a baseline estimate for the Panchayat.
- **Spatial Interpolation:** Inverse Distance Weighting (IDW) or Bilinear interpolation of coarse grid centers to the Panchayat centroid.
- **Climatological Correction:** Adjusting the interpolated value based on the historical mean error for that specific Panchayat for that time of year.

### Step 2: Feature Engineering
We extract high-resolution features for the Panchayat:
- **Terrain:** Mean elevation, slope, aspect (derived from DEM).
- **Land Cover:** Percentage of forest, urban, water, and agricultural land (from ESA WorldCover).
- **Temporal:** Day of year, season.

### Step 3: ML Residual Prediction
Instead of predicting the weather variable directly, the ML model (XGBoost) is trained to predict the **error (residual)** of the baseline.

`Residual = True Observed Value - Baseline Estimate`

The model learns: `Residual = f(Coarse Forecast, Terrain Features, Land Cover Features, Temporal Features)`

### Step 4: Final Prediction
`Final Downscaled Estimate = Baseline Estimate + Predicted Residual`

## 3. Evaluation
The model's performance is strictly evaluated by comparing the `Final Downscaled Estimate` against hidden ground-truth observations (`True Observed Value`). We must ensure spatial and temporal cross-validation to prevent data leakage (e.g., training on 2021-2022, testing on 2023).
