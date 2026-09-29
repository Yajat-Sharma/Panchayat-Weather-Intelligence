# Multi-variable, block-aware downscaling

## Variables and references

| Variable | Coarse input (ERA5 0.25°) | Fine reference | Baseline | Output range |
|---|---|---|---|---|
| Rainfall (mm/day) | `tp`, IST daily sum | CHIRPS v2.0 0.05° | coarse value | ≥ 0 |
| Tmax / Tmin (°C) | `t2m`, IST daily max/min | ERA5-Land 0.1° | coarse + 6.5 °C/km lapse rate | — |
| Relative humidity (%) | Magnus RH from `t2m`, `d2m`, IST daily mean | ERA5-Land 0.1° | coarse value | 0–100 |
| Wind (km/h) | √(u10² + v10²) × 3.6, IST daily mean | ERA5-Land 0.1° | coarse value | ≥ 0 |

The grid-cell elevation for the lapse rate comes from ERA5 surface geopotential / g during training. In operation it is the cell elevation Open-Meteo reports when called with `elevation=nan`.

**Independence caveat.** ERA5-Land is a land-surface re-run forced by ERA5 meteorology, so it is not an independent observation of temperature, humidity or wind. Skill against it shows that the model learns *terrain-driven refinement* (elevation, slope, land surface) of the coarse field. It does not show correction of ERA5 errors against the real atmosphere. Only rainfall (CHIRPS, which blends satellite and gauge data) is validated against a partly independent reference.

## Day definition
All hourly UTC data are shifted by +5 h 30 min and resampled to calendar days, keeping only complete 24-hour days. This matches the operational forecast, which Open-Meteo aggregates in `Asia/Kolkata`. Rainfall v1 used UTC days, so v2 rainfall numbers are not directly comparable with v1.

## Static features
- **v1:** area, centroid, DEM min/max/mean/std/p10/p50/p90.
- **v2 additions:** slope mean/std and TPI (from the DEM at about 90 m), aspect as a circular mean (sin/cos, flat ground excluded), ESA WorldCover 2021 fractions (cropland, tree, built-up, water) and mean distance to the nearest water pixel.
- **Selection rule:** v2 is deployed for a variable only if its pooled spatial-block RMSE is at least 1% lower than v1's. Otherwise the claim is not made for that variable. The result is in `metrics.json → variables.<var>.feature_set`.

## Uncertainty
Three XGBoost quantile regressors (`reg:quantileerror`, α = 0.1, 0.5, 0.9) are trained on the same residual. Crossing quantiles are sorted per row, and the reported *coverage* is the share of held-out observations inside [p10, p90] (target 0.80). For rainfall, an XGBoost classifier estimates P(rain > 2.5 mm). It is scored by Brier score against climatology, plus AUC.

## Block → Panchayat
For each block (`blkname`, grouped case-insensitively) and day, the coarse input is replaced by the area-weighted mean of the ERA5 values over the block's Panchayats. The ERA5 cell elevation is replaced the same way. A separate model is trained and cross-validated on this input. At inference:
- `GET /blocks/{b}/forecast` builds the block value from the live grid cells;
- `POST /blocks/{b}/downscale` accepts a bulletin value, which is assumed to represent the block's mean DEM elevation.

## Reproduce
```bash
uv run --project ml python ml/scripts/run_all.py
PYTHONPATH=. uv run --project ml pytest ml/tests
```
