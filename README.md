# Panchayat-level Weather Forecast Downscaling for Agro-Meteorological Advisory Services

## 1. Project Overview
This project aims to downscale coarse block-level or district-level weather forecasts (such as those from IMD or global models) to a high-resolution Panchayat-level spatial scale. The resulting high-resolution estimates, combined with uncertainty metrics, form the basis for localized agro-meteorological advisories.

## 2. SIH Problem Statement
"Downscaling of weather forecast from Block level to Panchayat level: Inferring high-resolution plots/data/information from low-resolution plots/data/information/variables for agro-meteorological advisory services."

## 3. Problem Explanation
Current weather forecasts often cover large grid cells (e.g., 9km, 12km, or block level). However, local microclimates can vary significantly within these boundaries due to topography, elevation, land cover, and proximity to water bodies. A single coarse forecast may miss localized rainfall or temperature inversions critical to agricultural decisions at the Panchayat scale.

## 4. Proposed Solution
A residual-correction downscaler turns a coarse forecast (ECMWF IFS / ERA5 at 0.25°, or a block-level bulletin value) into a value for every Gram Panchayat:

```
Panchayat value = baseline + XGBoost(coarse value, static Panchayat features, day of year)
baseline        = coarse value                              (rainfall, humidity, wind)
                = coarse value + 6.5 °C/km × (Panchayat elevation − grid-cell elevation)   (Tmax, Tmin)
```

What is implemented:
1. **Five variables:** rainfall, Tmax, Tmin, relative humidity and wind, each with its own model.
2. **Static features:** Copernicus 30 m DEM statistics. Slope, aspect, TPI, ESA WorldCover fractions (cropland, tree, built-up, water) and distance to water are also extracted, but each variable **uses them only if they improve spatial-block RMSE by at least 1%**; `data/models/metrics.json` records the choice per variable.
3. **Uncertainty:** p10 / p50 / p90 quantile models per variable, with the empirical coverage of the 80% range reported, plus P(rain > 2.5 mm) from a classifier.
4. **Block → Panchayat:** a model variant trained on the *area-weighted block mean* of ERA5, exactly as the problem statement phrases it. A user-supplied block forecast (e.g. an IMD block bulletin) can be downscaled through the API or the UI.
5. **Crop-aware advisory:** multi-day rules (irrigation, spraying, heat stress, fungal/pest risk, field work) for Rice, Soybean, Maize, Vegetables and Sugarcane. It returns reason codes, rendered in EN / HI / MR, and the AI copilot sees the same output.

**Current deployment state:** the committed model is **rainfall v1** (elevation features only). The multi-variable, quantile and block models are produced by `ml/scripts/run_all.py`, which needs Copernicus CDS credentials for ERA5 / ERA5-Land. Until that has been run, the API serves temperature through the lapse-rate baseline, passes humidity and wind through at the coarse value (both labelled "baseline only"), and returns no uncertainty band.

### Important Scientific Distinction
1. **Historical validation:** 2023 ERA5 reanalysis against the **CHIRPS reference** for rainfall (not "ground truth"), and against **ERA5-Land** for temperature, humidity and wind. ERA5-Land is driven by ERA5, so it is *not* independent; that skill measures terrain-driven refinement only.
2. **Operational forecast:** Open-Meteo's ECMWF IFS 0.25° forecast, requested with `elevation=nan` so the model sees the true grid-cell value. Live forecasts have **not** been verified against observations; every API response carries `validation_scope: historical_2023`.

## 5. System Architecture
- **Frontend:** Next.js mobile-first dashboard: map with coarse/downscaled choropleth, Panchayat and block views, advisory, AI copilot.
- **Backend:** FastAPI. A shared `ForecastService` snaps Panchayats to about 35 unique 0.25° cells, fetches them in one request and caches them for 1 hour. A `ModelRegistry` loads per-variable models, and `advisory_service` provides the rules.
- **ML pipeline:** `ml/downscaling/` (config, physics, terrain, training) plus idempotent scripts driven by `ml/scripts/run_all.py`.

*(See `docs/architecture/system-architecture.md` for more details)*

## 6. Technology Stack
- **Frontend:** Next.js, React, TypeScript, Tailwind CSS, Leaflet, Recharts
- **Backend:** Python, FastAPI, Pydantic, XGBoost
- **ML & Geospatial:** pandas, scikit-learn, XGBoost, GeoPandas, rasterio, rasterstats, xarray, SciPy

## 7. Data Pipeline
One command rebuilds everything from a fresh checkout, skipping steps whose outputs already exist:
```bash
uv run --project ml python ml/scripts/run_all.py            # --force to redo, --from <step> to resume
```
Steps: Panchayat boundaries → DEM → WorldCover → static features → ERA5 (precipitation, surface variables, geopotential) → ERA5-Land → CHIRPS → IST-daily extraction → dataset (including block means) → spatial-block validation → deployment.
Hourly data are aggregated to **IST calendar days** so they match the operational forecast (`timezone=Asia/Kolkata`).
*(See `docs/methodology/multi-variable-downscaling.md`)*

## 8. Data Sources
- **Coarse input:** ERA5 0.25° (historical), ECMWF IFS 0.25° via Open-Meteo (operational)
- **Fine references:** CHIRPS v2.0 0.05° (rainfall), ERA5-Land 0.1° (Tmax, Tmin, RH, wind)
- **Static:** Copernicus GLO-30 DEM, ESA WorldCover 2021 (10 m), Gram Manchitra / NIC Panchayat boundaries

*(See `docs/datasets/data-sources.md` for details)*

## 9. ML & Validation Methodology
- **Model:** XGBoost residual on top of the physical baseline above, one model per variable, with outputs clipped to physically possible ranges (rain ≥ 0, RH 0–100, wind ≥ 0).
- **Validation:** K-Means (K=5) spatial-block cross-validation on Panchayat centroids, so test regions are geographically unseen.
- **Reported per variable** (`GET /api/v1/metrics`, from `data/models/metrics.json`): baseline vs model RMSE/MAE per fold and pooled, v1 vs v2 feature comparison, 80% interval coverage and width, block-input RMSE, and for rainfall the heavy-rain RMSE and the Brier score / AUC of rain probability.
- **Recorded result so far:** rainfall v1, 38.45% pooled RMSE reduction (10.00 → 6.16 mm) over ERA5 on 1,351 Panchayats. The other variables have no numbers until the pipeline is run with CDS access.

## 10. Local Development Setup
**Prerequisites:** Python 3.10+, Node.js (for Next.js frontend). No PostgreSQL/PostGIS is required for the local Phase 5.5 demo.

### Running the Backend (FastAPI)
Open a terminal in the repository root (e.g., PowerShell):
```powershell
cd apps/api
# Install dependencies
uv sync
# Run the backend
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
The API will be available at `http://localhost:8000`.

### Running the Frontend (Next.js)
Open a new terminal in the repository root:
```powershell
cd apps/web
# Install dependencies
npm install
# Run the frontend
npm run dev
```
The dashboard will be available at `http://localhost:3000`.

## 11. Environment Variables
Copy `.env.example` to `.env` and fill in the required variables (DB connection, API keys if applicable).

## 12. Project Structure
- `apps/`: Frontend (web) and Backend (api)
- `ml/`: Machine learning pipelines and data providers
- `data/`: Raw and processed datasets
- `geospatial/`: GIS boundary files and raster processing scripts
- `docs/`: Technical documentation

## 13. API Overview
All under `/api/v1`:
- `GET /panchayats/{gp}/weather/forecast`: 7-day multi-variable forecast; each day has `{rainfall, tmax, tmin, rh, wind}` × `{coarse, baseline, correction, value, p10, p50, p90}` plus `rainfall.prob` (legacy flat rainfall fields kept for one release)
- `GET /panchayats/{gp}/advisory?crop=&day=`: advisory reason codes
- `GET /map/forecast?var=&date=`: coarse and downscaled value for every Panchayat (map layer)
- `GET /blocks`, `GET /blocks/{block}/forecast`, `POST /blocks/{block}/downscale`: block → Panchayat
- `GET /metrics`: validation results per variable
- `GET /panchayats`, `GET /panchayats/{gp}`, `GET /panchayats/{gp}/weather` (historical OOF), `POST /assistant/chat`

## 14. Current Implementation Status
- [x] Rainfall v1 model, spatial-block validated (38.45% RMSE reduction, 2023)
- [x] Multi-variable, quantile, rain-probability and block-input training code, tested end to end on synthetic data
- [ ] **Retraining with real ERA5 / ERA5-Land**: needs `~/.cdsapirc`, then `run_all.py`
- [x] Shared cached forecast service, multi-variable forecast, map, block, advisory and metrics endpoints
- [x] UI: temperature/humidity/wind, uncertainty band, rain chance, coarse vs downscaled map, block view with custom block forecast, backend advisory in EN/HI/MR
- [x] Panchayat AI Copilot grounded in the same forecast and advisory

## 15. Known Limitations
- ERA5-Land is not independent of ERA5; the non-rain skill measures terrain refinement, not error correction against observations.
- The training year is 2023 only. Live forecasts are unverified, and ECMWF forecast error differs from ERA5 reanalysis error.
- Advisory thresholds are indicative agronomic rules, not validated crop models.
- The rainfall v1 model uses `day_of_year` and learns a seasonal CHIRPS-vs-ERA5 bias, so it can add several mm even when the coarse input is near zero.

## 16. Future Roadmap
- Multi-year training, and verification of live forecasts against IMD AWS / gauge data.
- CRPS-based probabilistic evaluation; deep-learning downscalers (U-Net).
