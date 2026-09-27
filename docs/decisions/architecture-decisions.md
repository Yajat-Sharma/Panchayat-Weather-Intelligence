# Architecture Decisions

## 1. Monorepo Structure
**Decision:** We are using a monorepo containing the frontend, backend, ML pipelines, and data processing scripts.
**Rationale:** The SIH problem requires tight coupling between data ingestion, ML downscaling, and API serving. A monorepo ensures that changes to the core data schema are instantly reflected across the ML pipeline and backend API, easing deployment and development.

## 2. FastAPI for Backend
**Decision:** The backend API is built using FastAPI.
**Rationale:** FastAPI provides out-of-the-box asynchronous support, automatic OpenAPI (Swagger) documentation, and strong Pydantic typing, which is highly beneficial when serving ML model predictions and integrating with SQLAlchemy/PostGIS.

## 3. PostgreSQL + PostGIS
**Decision:** The primary database is PostgreSQL with the PostGIS extension.
**Rationale:** We need to perform spatial queries (e.g., finding the Panchayat bounding box, nearest weather stations, joining raster statistics to geometries). PostGIS is the industry standard for robust geospatial database operations.

## 4. XGBoost for Residual Correction
**Decision:** The initial ML model will be XGBoost trained on the baseline residual, rather than a Deep Neural Network.
**Rationale:** XGBoost is highly efficient for tabular data (terrain stats, land cover fractions) and is significantly easier to train and interpret with limited data than a complex CNN/ConvLSTM, which remains on the roadmap for future development.

## 5. Abstraction of Data Providers
**Decision:** All external data sources are accessed via abstract interface classes (e.g., `WeatherDataProvider`).
**Rationale:** APIs and dataset availability may change during the hackathon. Abstract interfaces allow us to swap between dummy local data, ERA5 netCDF files, and live IMD APIs without changing the core ML pipeline.
