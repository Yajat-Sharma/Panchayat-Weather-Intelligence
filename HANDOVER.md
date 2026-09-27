# SIH Weather Downscaling — Project Handover

## 1. Project Objective
"Downscaling of weather forecast from Block level to Panchayat level for agro-meteorological advisory services."

The project aims to construct a highly rigorous, scientifically valid machine learning pipeline capable of downscaling coarse-resolution meteorological predictions (such as ERA5 or block-level operational forecasts) to a fine 30-meter geospatial resolution aligned with Gram Panchayat administrative boundaries. The system will leverage local terrain features and climatology to predict residuals, which will ultimately drive localized agro-meteorological advisory services.

---

## 2. Current Architecture
coarse weather
+
terrain
+
land cover / geospatial features
+
historical weather
+
observations
↓
downscaling/post-processing
↓
Panchayat-level weather
↓
uncertainty
↓
agro-meteorological advisory

---

## 3. Current Repository Structure
```
data/
  ├── interim/       # Processing artifacts, JSON audits
  ├── raw/           # Raw, immutable downloaded datasets (weather, terrain, boundaries, target)
  └── processed/     # Extracted features, targets, ML datasets, and final predictions
docs/
  ├── datasets/      # Dataset provenance and audit reports
  ├── methodology/   # Pipeline architecture, leakage audit, and target selection documents
ml/
  ├── data/          # Dataset ingest adapters (e.g. ERA5Provider)
  ├── scripts/       # CLI entrypoints (pipeline.py, download_dem.py, download_era5.py, extract_weather.py)
  ├── experiments/   # Pipeline downscaling logic
  ├── tests/         # Unit tests and audit enforcement scripts
apps/
  ├── api/           # FastAPI backend
  ├── web/           # Next.js frontend with Recharts timeseries and Leaflet Map
```

---

## 4. Phase Status
| Phase | Description | Status |
|---|---|---|
| 1 | Foundation | COMPLETE |
| 2 | Geospatial pipeline | COMPLETE |
| 3 | Synthetic ML experiment | COMPLETE |
| 4A | Real-data infrastructure | COMPLETE |
| 4B | Real-data audit | COMPLETE |
| 4C | Dataset acquisition | COMPLETE |
| 4D | ERA5 setup | COMPLETE |
| 4E | ERA5 acquisition | COMPLETE |
| 4F | Panchayat Boundaries | COMPLETE |
| 5 | Real-data preprocessing | COMPLETE |
| 5.5 | Local Full-Stack Demo | COMPLETE |
| 6 | Real-data downscaling | COMPLETE |

---

## 5. Dataset Status
| Dataset | Status | Location | Resolution | Source |
|---|---|---|---|---|
| Copernicus GLO-30 DEM | READY | data/raw/terrain/pune_dem.tif | ~30m (EPSG:4326) | Copernicus |
| ERA5 | READY | data/raw/weather/era5_pune_2023.nc | 0.25° | Copernicus CDS |
| Panchayat boundaries | READY | data/raw/boundaries/pune_panchayats.geojson | TBD | Gram Manchitra/NIC |
| Static Features | READY | data/processed/features/panchayat_static_features.parquet | N/A | Extracted locally |
| Weather Features | READY | data/processed/weather/panchayat_era5_weather.parquet | N/A | Extracted locally |
| CHIRPS v2.0 Target | READY | data/raw/target/chirps_p05_2023.nc | 0.05° | UCSB CHG |
| ML Dataset | READY | data/processed/features/panchayat_downscaling_dataset.parquet | N/A | ML Pipeline |
| ML Predictions | READY | data/processed/predictions/test_predictions.parquet | N/A | XGBoost Model Output |

---

## 6. Scientific Decisions
- **Raw datasets must remain immutable.** Any transformations, conversions (e.g. m to mm), or spatial clipping must happen later under `data/interim/` or `data/processed/`.
- ERA5 is reanalysis, NOT operational forecast.
- **Scientific Resolution Check:** ERA5 has an exact measured grid spacing of 0.25°. At Pune's latitude (~18°N), this is approximately 27 km × 26 km (700+ sq km per grid cell). A typical Gram Panchayat is significantly smaller (mean ~10 sq km). Therefore, ERA5 must serve strictly as a **coarse meteorological input**. It cannot serve as the final fine target for Panchayat-level truth.
- Standard ERA5 resolution (~31km) is insufficient to automatically claim Panchayat-scale truth. A finer target dataset must be used for genuine Panchayat validation.
- **CHIRPS v2.0 (0.05°)** was selected as the fine-resolution target because it relies primarily on satellite infrared (CCD) and station data rather than numerical modeling, preventing spatial circularity leakage with ERA5.
- No fabricated data.
- No fabricated metrics.
- No operational forecast validation claims unless actual operational forecast data is available.
- Processing should occur in interim/processed layers.
- **Boundaries MUST be Gram Panchayats**. Village, block, or ward polygons cannot be blindly substituted.

---

## 7. Data Provenance
- **Terrain Data**: Copernicus GLO-30 DEM (`s3://copernicus-dem-30m`). Downloaded 2026-09-27. Resolution: ~30m (EPSG:4326). Variables: Elevation. 17°N-20°N, 73°E-76°E.
- **Weather Data**: ERA5 Reanalysis Single Levels (`cds.climate.copernicus.eu`). Downloaded 2026-09-27. Resolution: 0.25°. Variables: Total Precipitation (`tp`). 17.0N-20.0N, 72.5E-75.5E.
- **Boundaries**: Pune Gram Panchayats. Downloaded 2026-09-27 from Ministry of Panchayati Raj / NIC ArcGIS REST service (1,545 polygons).
- **Target Data**: CHIRPS v2.0 (`data.chc.ucsb.edu`). Downloaded 2026-09-27. Global Daily 2023. Resolution: 0.05°. Variables: Precipitation.

---

## 8. ML Status (Phase 6 Results)
- **Model**: XGBoost Regressor (Residual Downscaling)
- **Training Data**: 2023 ERA5 Coarse Weather, GLO-30 DEM Static Features, Spatial Coordinates, Temporal Features.
- **Target**: CHIRPS v2.0 Precipitation (0.05°)
- **Validation Strategy**: Strict Spatial Holdout (20% of Panchayats held out, 271 GPs). (Random sampling).
- **Leakage Check**: Enforced by strict spatial splitting and feature inspection (Documented in `docs/methodology/leakage-audit.md`). No target-derived features are present.
- **Metrics (Holdout Set)**:
    - **Baseline (ERA5) RMSE:** 10.11 mm
    - **Baseline (ERA5) MAE:** 3.54 mm
    - **Model (XGBoost) RMSE:** 4.62 mm
    - **Model (XGBoost) MAE:** 1.53 mm
    - **Absolute RMSE Reduction:** 5.50 mm
    - **RMSE Improvement:** 54.34%

The model successfully learns to localize coarse precipitation forecasts using local terrain.

**Result Classification:** PRELIMINARY RESULT REQUIRING STRONGER VALIDATION
While the 54.3% improvement is mathematically robust and free of temporal/feature leakage, the random spatial split is susceptible to geographic autocorrelation. A spatial-block validation design is recommended for future iterations to make definitive claims.

---

## 9. Current Blockers
- None. Phase 6.1 Audit is complete.

---

## 10. Local App Status
- **Backend (FastAPI)**: READY. Available at `http://localhost:8000`. Runs from `apps/api`. No PostgreSQL required for demo. Uses Parquet/GeoJSON cache.
  - Endpoints: `GET /health`, `GET /api/v1/status`, `GET /api/v1/panchayats`, `GET /api/v1/panchayats/{id}`, `GET /api/v1/panchayats/{id}/weather`
  - The weather endpoint now dynamically fetches the Experimental XGBoost predictions vs ERA5 baseline vs CHIRPS Reference.
- **Frontend (Next.js)**: READY. Available at `http://localhost:3000`. Runs from `apps/web`.
  - Pages: Dashboard with Leaflet map, API integration, and Recharts timeseries visualizations.
  - Terminology explicitly flags the model as experimental and CHIRPS as the reference, not ground truth.

---

## 11. Last Completed Work
- Completed Phase 6.1 Scientific Validation Audit.
- Audited datasets, discovering 1,351 unique Panchayats derived from 1,545 original geometries.
- Independently recalculated metrics, confirming the 54.3% RMSE reduction (5.50 mm absolute reduction).
- Verified the complete absence of feature or temporal leakage.
- Analyzed error by rainfall intensity, proving XGBoost halves the RMSE even during heavy (>50mm) rainfall events (55.65mm to 28.46mm).
- Updated frontend terminology to prevent misleading claims about "ground truth".
- Documented downscaling formulation and spatial validation limitations.

---

## 12. Current Next Step
Implement Spatial Block Cross-Validation for the XGBoost model to rigorously prove geographic generalization.

---

## 13. Last Updated
Last updated:
2026-09-28 02:22

Phase:
6.1

Status:
COMPLETE (AUDITED)
