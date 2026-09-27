# Acquired Data Provenance

This document tracks the acquisition, provenance, and readiness of the real datasets intended for the Phase 4/5 pilot in Pune, Maharashtra.

## 1. Terrain Data (DEM)
- **Dataset Name:** Copernicus GLO-30 Digital Elevation Model
- **Source Organization:** ESA / Copernicus (via AWS Open Data Registry)
- **Official URL:** `s3://copernicus-dem-30m`
- **Download Date:** 2026-09-27
- **Variables:** Elevation (meters)
- **Spatial Resolution:** 30 meters (1 arc-second)
- **CRS:** EPSG:4326
- **Geographic Extent:** 17°N to 19°N, 73°E to 75°E (covers Pune)
- **License/Access Conditions:** Free and open access (boto3 unsigned request).
- **Processing Performed:** 6 individual 1°×1° `.tif` tiles were downloaded and mosaicked into a single continuous raster (`pune_dem.tif`) using `rasterio`.
- **Status:** **SUCCESS**

## 2. Weather Data (ERA5)
- **Dataset Name:** ERA5 Reanalysis (Single Levels)
- **Source Organization:** ECMWF / Copernicus Climate Data Store (CDS)
- **Official URL:** https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels
- **File:** `era5_pune_2023.nc` (Saved in `data/raw/weather/era5_pune_2023.nc`)
- **Variables:** Total Precipitation (`tp`)
- **Status:** **SUCCESS**
- **Size:** 0.92 MB
- **Acquisition Date:** 2026-09-27
- **Time Range:** 2023-01-01 00:00:00 to 2023-12-31 23:00:00 (8760 hourly timestamps exactly, no missing/duplicates)
- **Spatial Resolution:** 0.25° × 0.25° grid (~27km × ~26km at Pune's latitude)
- **Geographic Extent:** 18.0°N to 19.5°N, 73.0°E to 75.0°E
- **Precipitation Semantics (Verified):**
  - **Original Units:** meters (`m`)
  - **Temporal Accumulation:** Accumulated over the preceding hour.
  - **Conversion:** Must be multiplied by 1000 to convert from meters to millimetres (`mm`).
  - **Daily Aggregation:** To get daily precipitation, the hourly values must be summed over a 24-hour period (and timezone-shifted from UTC to IST if local day bounds are required). *The raw NetCDF file will not be mutated; any conversions must be performed in-memory during preprocessing.*
- **Processing Performed:** None. Downloaded as raw, unmutated NetCDF. Files merged by coordinates natively via `xarray`/`dask` from 12 monthly downloads.

## 3. Boundary Data (Gram Panchayats)
- **Dataset Name:** Pune Gram Panchayat Boundaries
- **Preferred Source:** DataMeet / Local Government Directory (LGD)
- **Status:** **BLOCKED**
- **Reason:** The authoritative DataMeet repository provides village-level points, district bounds, and state bounds, but does NOT provide comprehensive Gram Panchayat polygon vectors. The official Government of India Local Government Directory (LGD) provides this data but it requires manual web-portal navigation (CAPTCHAs) and cannot be scraped reliably via standard automated scripts.
- **Action Required:** The user must manually download the Gram Panchayat Shapefile/GeoJSON for Pune from an authoritative source and place it at `data/raw/boundaries/pune_panchayats.geojson`.

## Conclusion
The data acquisition phase is **INCOMPLETE**. The DEM has been successfully acquired, but the weather and boundary layers require user authentication/manual downloading.
