# Phase 4B/4C: Real Data Readiness and Acquisition Report

**Date:** 2026-09-27
**Target Region:** Pune, Maharashtra
**Final Decision:** **BLOCKED — DATA ACQUISITION INCOMPLETE**

## 1. Executive Summary
This report evaluates the scientific readiness and acquisition status of the required datasets for Phase 4 of the Panchayat-level weather forecast downscaling project. While the high-resolution Digital Elevation Model (DEM) was successfully downloaded and merged from official Copernicus AWS buckets, both the Panchayat boundaries and ERA5 weather data are blocked due to authentication and source availability constraints. 

No ML training or aggregation can proceed until these blockers are manually resolved.

## 2. Acquisition Status

### A. Terrain Data (DEM)
- **Status:** **SUCCESS**
- **Filename:** `data/raw/terrain/pune_dem.tif`
- **Size:** 445 MB
- **Source:** Copernicus GLO-30 DEM (AWS Open Data Registry `s3://copernicus-dem-30m`)
- **Format:** GeoTIFF
- **Details:** 9 tiles covering 17°N to 20°N and 73°E to 76°E were merged successfully. Resolution is ~30m (EPSG:4326).

### B. Panchayat Boundaries
- **Status:** **BLOCKED**
- **Filename:** `data/raw/boundaries/pune_panchayats.geojson` (Still 0 bytes)
- **Reason:** Authoritative GIS datasets for Gram Panchayats (specifically) are not available in open developer repositories like DataMeet, and the Government of India Local Government Directory (LGD) portal requires manual interaction/CAPTCHAs for extraction.

### C. Weather Dataset (ERA5)
- **Status:** **BLOCKED**
- **Filename:** `data/raw/weather/era5_pune_2023.nc` (Still 0 bytes)
- **Source:** Copernicus Climate Data Store (CDS)
- **Reason:** Requires CDS API user credentials (`~/.cdsapirc`), which are not present on this machine. A downloader script (`ml/scripts/download_era5.py`) has been provided to retrieve 2023 Total Precipitation once credentials are provided.

## 3. Scientific Suitability (ERA5)
*Unable to fully compute quantitative comparison due to missing boundary data.*

However, qualitatively: ERA5 has an approximate horizontal resolution of ~31 km (0.25°). A typical Gram Panchayat is significantly smaller than a 31km × 31km grid cell. Therefore, when acquired, ERA5 will act as the **coarse/reanalysis input** rather than the fine target. It is **insufficient as the final Panchayat-scale target** without spatial downscaling utilizing the 30m DEM.

## 4. Remaining Blockers
1. **Panchayat Boundaries**: User must manually source and place a valid GeoJSON/Shapefile into `data/raw/boundaries/pune_panchayats.geojson`.
2. **ERA5 Weather**: User must configure `~/.cdsapirc` with CDS API credentials and execute `uv run python scripts/download_era5.py`.

## 5. Next Step

**BLOCKED — DATA ACQUISITION INCOMPLETE**

Do not proceed to Phase 5 until all datasets are successfully acquired and verified by the pipeline.
