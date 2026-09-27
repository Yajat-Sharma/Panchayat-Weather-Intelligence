# Operational Forecast Input Requirements

The XGBoost residual downscaling model was trained on historical ERA5 Reanalysis data. To successfully deploy this model operationally (e.g., providing daily agricultural advisories for the upcoming week), the API must be supplied with a genuine numerical weather prediction (NWP) forecast input.

## Input Source Compatibility

Before integrating a forecast source (e.g., IMD GFS, NCMRWF, ECMWF IFS), it must be rigorously evaluated for statistical and physical compatibility with the ERA5 training baseline.

### Essential Requirements
1. **Compatible Variable:** Must provide quantitative total precipitation accumulation (not probability of precipitation or instantaneous rain rate).
2. **Compatible Units:** Must be convertible to millimeters (mm).
3. **Temporal Resolution:** Must provide a 24-hour daily accumulation that can be aligned with the local definition of a "day" (e.g., 00:00 to 00:00 UTC, or local equivalent).
4. **Spatial Resolution:** Should ideally be near the ERA5 resolution (0.25° × 0.25° ~ 25km-31km). Supplying a severely mismatched resolution (e.g., 2.5° or 1km) breaks the spatial assumptions learned by the model.

### Input Distribution Shift Risk
Because an operational forecast is predicting the future, its error profile differs fundamentally from reanalysis (which assimilates past observations).
- The model expects the specific bias profile of ERA5.
- If the chosen operational model consistently over-predicts rainfall compared to ERA5, the XGBoost model's residual corrections will be misaligned, leading to amplified errors.
- **Action Required:** Before production deployment, perform a distribution shift analysis comparing the chosen NWP forecast against ERA5 for the same historical period.

## Status: NOT YET INTEGRATED
Currently, the `/weather/live` API strictly performs **Historical Experimental Inference**. No future operational forecast feed has been approved or integrated.
