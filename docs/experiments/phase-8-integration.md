# Phase 8: Operational Forecast Integration

## Objective
Enable real-time, live operational weather downscaling by integrating a genuine numerical weather prediction (NWP) feed into the XGBoost pipeline.

## ECMWF IFS Selection & Distribution Shift Justification
We successfully integrated the **ECMWF IFS 0.25°** (European Centre for Medium-Range Weather Forecasts, Integrated Forecasting System) model using the Open-Meteo REST API. 

### Why ECMWF IFS?
When integrating a new operational input into an ML model trained on reanalysis, **input distribution shift** is the primary scientific risk. If the operational model uses different physical parameterizations or resolutions than the training dataset (ERA5), the model's residual corrections will be misaligned, amplifying bias errors rather than correcting them.

ERA5 is the 5th generation ECMWF Reanalysis. It relies on a historical version of the ECMWF Integrated Forecasting System running at ~31km (0.25°) resolution. 

By selecting the live ECMWF IFS 0.25° model for our operational forecasts, we:
1. Maintain exactly the same spatial resolution (0.25°).
2. Utilize nearly identical atmospheric physics and parameterizations for precipitation.
3. Mathematically minimize input distribution shift compared to using GFS or NCMRWF.

## Backend Implementation
- A new endpoint `GET /api/v1/panchayats/{gpcode}/weather/forecast` was added to `apps/api/app/main.py`.
- When called, the FastAPI backend dynamically proxies a request to `api.open-meteo.com` using the precise latitude/longitude centroid of the target Gram Panchayat.
- It requests 7 days of future precipitation using `models=ecmwf_ifs025`.
- The raw coarse forecast is bundled with the Panchayat's static terrain features (elevation, area) and passed through the `WeatherDownscaler` XGBoost inference pipeline.
- The response is deterministically clipped to `0.0mm` for any negative residuals and tagged as `"prediction_type": "live_operational_forecast"`.

## Frontend Integration
The Next.js Dashboard now visualizes the 7-day Operational Forecast in a dedicated side-by-side panel alongside the Historical Validation. The system is now fully localized and operationally capable.
