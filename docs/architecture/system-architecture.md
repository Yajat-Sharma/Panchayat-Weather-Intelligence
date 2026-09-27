# System Architecture

## Monorepo Layout
The repository is structured to separate concerns and ensure maintainability:

- **apps/web:** The Next.js frontend application (Deferred).
- **apps/api:** The FastAPI backend providing REST endpoints, interacting with the PostGIS database.
- **ml/:** The core Python package for data processing, feature engineering, and model training.
- **geospatial/:** Scripts for handling static boundary files (shapefiles, GeoJSON) and raster operations (clipping, masking).
- **data/:** Directory to store datasets (git-ignored for raw/processed data).

## Component Interaction
1. **Data Ingestion:** Scripts in `ml/data/` fetch coarse forecasts and observations from external sources via defined `Provider` interfaces.
2. **Preprocessing:** `ml/preprocessing/` and `geospatial/scripts/` align disparate spatial data (rasters and vector boundaries) to the same CRS and resolution.
3. **Model Training:** `ml/training/` reads aligned data, generates features, and trains the XGBoost residual model, outputting serialized artifacts to `ml/models/`.
4. **Inference (API):** When a request is made to the FastAPI backend (`POST /downscale` or `GET /predictions`), the backend invokes the inference module in `ml/inference/` utilizing the latest model artifact.
5. **Advisory Generation:** Based on the downscaled weather output, `apps/api/app/services/advisory.py` runs configurable rules to generate agro-meteorological advisories.

## Database Design
We use PostgreSQL with the PostGIS extension.
- **Spatial Tables:** `Panchayat`, `Block`, `District` store geometry (`MultiPolygon`).
- **Time-series Tables:** `WeatherObservation`, `WeatherForecast`, `WeatherPrediction` store time-indexed weather values linked to specific `panchayat_id`s.

*(See API models in `apps/api/app/models/` for schema definitions)*
