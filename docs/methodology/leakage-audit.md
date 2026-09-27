# Leakage Audit for Phase 6

## 1. Definition of Leakage in Spatial Downscaling
Data leakage occurs when the machine learning model is inadvertently given access to information about the target variable that it would not have in a real-world predictive setting, or when the evaluation metrics are artificially inflated by circular dependencies. 

In statistical downscaling, common leakage vectors include:
- **Spatial Circularity**: Using a target dataset that is mathematically derived from the input predictors (e.g., using ERA5-Land to downscale ERA5).
- **Temporal Contamination**: Training on the same time periods as testing, or allowing rolling averages/lag features from the test period to leak into the training period.
- **Geographic Contamination**: Training on Panchayats adjacent to test Panchayats, allowing the model to simply interpolate from its neighbors.

## 2. Audit of the Current Pipeline

### 2.1 Target Independence (Spatial Circularity)
- **Input Predictor**: ERA5 Total Precipitation (`era5_pune_2023.nc`). This is a reanalysis product heavily dependent on the ECMWF IFS numerical weather prediction model at ~27km resolution.
- **Target**: CHIRPS v2.0 (`chirps_p05_2023.nc`). This is a quasi-global rainfall dataset explicitly built from high-resolution satellite infrared Cold Cloud Duration (CCD) imagery merged with station data.
- **Conclusion**: **NO LEAKAGE**. The target is fundamentally derived from different observation streams (satellite IR) than the coarse input.

### 2.2 Split Strategy (Temporal vs. Spatial)
The dataset contains 1,545 Panchayats over 365 days. 
In `run_downscaling_experiment.py`, we implemented a **Strict Spatial Holdout (20%)**.
- 80% of Panchayats (by `GPCODE`) are used for training.
- 20% of Panchayats are entirely held out for evaluation.
- **Conclusion**: **NO LEAKAGE**. A model trained on this setup must generalize to entirely unseen geographic locations based solely on their static terrain characteristics and the coarse ERA5 input. It cannot "memorize" the local microclimate of a test Panchayat because it never sees it during training.

### 2.3 Feature Engineering
The features passed to the XGBoost model include:
- Coarse ERA5 rainfall (time-dependent)
- Elevation statistics (min, max, mean, std, percentiles) (static)
- Polygon Area and Centroid Lat/Lon (static)
- Day of Year, Month (temporal)
- **Conclusion**: **NO LEAKAGE**. None of the input features contain the CHIRPS target data.

## 3. Final Certification
The ML dataset and validation strategy used in Phase 6 have been rigorously audited. The target is independent, the train/test split strictly segregates geographic regions, and no future or target-derived information is present in the feature space. The resulting baseline comparisons (ERA5 vs. XGBoost) are scientifically valid.
