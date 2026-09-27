# Model Inference Formula

This document details the exact mathematical operations executed by the API during live inference (`/weather/live` and `/weather/batch`).

## 1. Feature Assembly
The API constructs a 13-dimensional vector for the target Gram Panchayat:
- **Dynamic Inputs:** `era5_rainfall_mm`, `day_of_year`, `month`
- **Static Terrain Caches:** `elevation_min`, `elevation_max`, `elevation_mean`, `elevation_std`, `elevation_p10`, `elevation_p50`, `elevation_p90`, `area_sqkm`, `centroid_lat`, `centroid_lon`

## 2. Residual Prediction
The XGBoost model processes the feature vector to predict the local deviation (residual) from the coarse baseline:
$$ \text{Residual}_{\text{pred}} = \text{XGBoost}(\text{Features}) $$

## 3. Recombination
The predicted residual is added back to the coarse input baseline to form the raw prediction:
$$ \text{Raw Prediction} = \text{ERA5\_Rainfall} + \text{Residual}_{\text{pred}} $$

## 4. Physical Constraints (Clipping)
Rainfall cannot be physically negative. The raw prediction is deterministically bounded at zero:
$$ \text{Final Downscaled Prediction} = \max(0, \text{Raw Prediction}) $$

## 5. Input Validation
To prevent catastrophic failures, the API enforces strict parameter constraints:
- Input rainfall cannot be `NaN`.
- Input rainfall cannot be infinite (`inf`).
- Input rainfall cannot be negative.
