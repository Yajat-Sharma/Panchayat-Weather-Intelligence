# Phase 3: Controlled Downscaling Experiment

## 1. Why a Controlled Experiment?
Because true historical operational IMD block-level forecasts are not easily available in high resolution, we use a **Historical Reconstruction** paradigm. We mathematically aggregate a high-resolution "truth" field (e.g. 5km) into a coarse field (25km). This completely controls the information loss. If our model can downscale the 25km field back to the 5km field more accurately than a baseline interpolator, we have mathematically proven the downscaling hypothesis.

## 2. Reanalysis vs. Forecast
Reanalysis data (like ERA5) includes observations combined with physical models to create a "best guess" of the past. It is structurally different from a forward-looking operational forecast, which contains inherent uncertainty. Thus, we claim our model is a "historical reconstruction prototype" rather than a "forecast system" until real IMD forecast inputs are attached.

## 3. Coarse Field Generation
Generated using `ml.experiments.aggregation.SpatialAggregator`. We group the fine spatial coordinates into blocks and calculate the block-mean (appropriate for precipitation volumes).

## 4. Target Definition
The target $Y$ is the original, unmodified high-resolution precipitation value at each coordinate.

## 5. Baselines
We track the Block/Nearest-Neighbour interpolation. The block mean inherently smooths all topography.

## 6. Residual Learning
`ml.models.xgboost_residual.XGBoostResidualDownscaler` learns the residual mapping: 
$Residual = Y_{true} - Y_{baseline}$
This forces XGBoost to only focus on topographically-driven deviations rather than learning absolute weather physics.

## 7. Validation Strategy
`ml.evaluation.splits.temporal_split` isolates the latest months of the year (e.g. October onwards) as unseen test data. The model cannot cheat using future dates.

## 8. Leakage Prevention
The spatial aggregation block indices perfectly encapsulate the fine points; no moving windows bleed spatial information. All scaling and model fitting strictly occurs on the training partition.

## 9. How this connects to future IMD Forecasts
When IMD Block-level forecasts arrive, they conceptually replace the "Coarse Field" in this experiment. The target $Y$ becomes AWS/ARG observations. The exact same feature builder and XGBoost residual architecture applies directly.
