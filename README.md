# Panchayat-level Weather Forecast Downscaling for Agro-Meteorological Advisory Services

## 1. Project Overview
This project aims to downscale coarse block-level or district-level weather forecasts (such as those from IMD or global models) to a high-resolution Panchayat-level spatial scale. The resulting high-resolution estimates, combined with uncertainty metrics, form the basis for localized agro-meteorological advisories.

## 2. SIH Problem Statement
"Downscaling of weather forecast from Block level to Panchayat level: Inferring high-resolution plots/data/information from low-resolution plots/data/information/variables for agro-meteorological advisory services."

## 3. Problem Explanation
Current weather forecasts often cover large grid cells (e.g., 9km, 12km, or block level). However, local microclimates can vary significantly within these boundaries due to topography, elevation, land cover, and proximity to water bodies. A single coarse forecast may miss localized rainfall or temperature inversions critical to agricultural decisions at the Panchayat scale.

## 4. Proposed Solution
We propose a spatial downscaling pipeline that fuses:
1. Coarse forecasts (IMD / Global models)
2. High-resolution terrain features (Elevation, Slope, Aspect)
3. Land cover features (Vegetation, Water, Urban fraction)
4. Local observations (Satellite estimates, AWS where available)

This pipeline uses an ML-based residual correction approach (e.g., XGBoost) built on top of a baseline spatial interpolation/climatological correction, outputting both the prediction and uncertainty metrics.

## 5. System Architecture
The repository uses a clean monorepo structure separating the frontend, backend API, ML pipelines, and geospatial data processing.
- **Frontend (Planned):** Next.js dashboard for visualizing maps and advisories.
- **Backend:** FastAPI for serving predictions and processing data.
- **ML Pipeline:** Reproducible ML training pipeline for generating downscaled artifacts.
- **Database:** PostgreSQL with PostGIS for spatial queries.

*(See `docs/architecture/system-architecture.md` for more details)*

## 6. Technology Stack
- **Frontend:** Next.js, React, TypeScript, Tailwind CSS, Mapbox/Leaflet
- **Backend:** Python, FastAPI, SQLAlchemy, Pydantic
- **ML & Geospatial:** Python, pandas, scikit-learn, XGBoost, GeoPandas, rasterio, xarray
- **Database:** PostgreSQL + PostGIS
- **Infrastructure:** Docker, Render/Vercel (Planned)

## 7. Data Pipeline
The preprocessing pipeline strictly manages CRS validations, raster masking, and feature generation (e.g., extracting DEM zonal statistics per Panchayat). The pipeline outputs reproducible `.parquet` files.
*(See `docs/methodology/data-pipeline.md` for details)*

## 8. Data Sources
- **Forecasts:** IMD, ERA5 / AgERA5
- **Observations:** IMD AWS/ARG (where accessible), INSAT/GSMaP
- **Geospatial:** SRTM DEM, ESA WorldCover, Government Panchayat Boundaries

*(See `docs/datasets/data-sources.md` for details)*

## 8. ML Methodology
1. **Baseline 1:** Simple spatial interpolation (Nearest Neighbor / Bilinear).
2. **Baseline 2:** Historical/climatological correction.
3. **ML Model:** XGBoost trained to predict the residual (difference) between the baseline and observed truth, using terrain and land-cover features.

*(See `docs/methodology/downscaling.md` for details)*

## 9. Validation Methodology
The system strictly distinguishes between coarse forecasts, baseline estimates, ML predictions, and ground-truth observations.
Metrics implemented:
- **Continuous:** MAE, RMSE, Bias, Correlation
- **Categorical (Rainfall):** POD (Probability of Detection), FAR (False Alarm Ratio), CSI (Critical Success Index)

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
*(Planned endpoints)*
- `GET /health`
- `GET /panchayats/{id}`
- `POST /downscale`
- `GET /advisory/{panchayat_id}`

## 14. Current Implementation Status
**Phase 3: Historical Reconstruction Prototype**
We are currently evaluating the XGBoost residual downscaling model using a controlled "Historical Reconstruction" experiment. A synthetic high-resolution weather field (e.g. 5km) is aggregated to a coarse field (25km) to simulate reanalysis data, and the model attempts to reconstruct the 5km field using topographical features.

- [x] Initial architecture design and monorepo structure
- [x] Documentation foundation
- [x] Data abstraction contracts
- [x] Initial database schema design
- [x] Baseline ML module structure
- [x] ML preprocessing pipelines (spatial masking, CRS mapping)
- [x] Phase 3: XGBoost Residual ML Experiment 
- [ ] API implementation
- [ ] Frontend dashboard

## 15. Known Limitations
- Relies on the availability of accurate Panchayat boundary files.
- ML residual correction requires sufficient historical observation data for training.

## 16. Future Roadmap
- Implementation of deep-learning models (U-Net, ConvLSTM).
- Real-time satellite data integration.
- Probabilistic forecast generation (CRPS).
