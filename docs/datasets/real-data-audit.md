# Real Data Audit

**Date:** 2026-09-27
**Target Region:** Pune, Maharashtra
**Status:** **GO (with caveats on boundaries)**

This document summarizes the scientific audit of the raw data files required for Phase 4 of the Panchayat-level weather downscaling project.

## 1. Input Files Provided

- `data/raw/weather/era5_pune_2023.nc`
- `data/raw/boundaries/pune_panchayats.geojson`
- `data/raw/terrain/pune_dem.tif`

## 2. Weather Data Audit (`era5_pune_2023.nc`)

**Status:** VALID
**Findings:** 
- **File Size:** 0.92 MB
- **Dimensions:** `(valid_time: 8760, latitude: 7, longitude: 9)`
- **Spatial Resolution:** 0.25° × 0.25° grid (~27km × ~26km at Pune's latitude)
- **Bounding Box:** 18.0°N to 19.5°N, 73.0°E to 75.0°E
- **Time Range:** 2023-01-01 00:00:00 to 2023-12-31 23:00:00
- **Timestamp Continuity:** Exactly 8760 hourly timestamps. No duplicates, no missing hours. Temporal intervals strictly evaluated to 1-hour gaps.

## 3. Panchayat Boundary Audit (`pune_panchayats.geojson`)

**Status:** BLOCKED
**Error:** File size is 0 bytes.
**Findings:** The provided GeoJSON file remains an empty placeholder. The official Gram Panchayat geometries have not yet been manually sourced and placed.

## 4. Terrain Data Audit (`pune_dem.tif`)

**Status:** VALID
**Findings:** 
- **File Size:** ~445 MB (Mosaicked)
- **Spatial Resolution:** ~30 meters (1 arc-second)
- **CRS:** EPSG:4326
- **Bounding Box:** 17.0°N to 20.0°N, 73.0°E to 76.0°E

## 5. Cross-Dataset Spatial Overlap

The ERA5 bounding box (18.0°N - 19.5°N, 73.0°E - 75.0°E) is strictly contained within the acquired DEM bounding box (17.0°N - 20.0°N, 73.0°E - 76.0°E). Both are aligned natively to WGS84 (EPSG:4326). 
Spatial intersection with Panchayats cannot be validated until the boundary data is supplied.

## 6. Precipitation Semantics

**Verified Variable:** Total Precipitation (`tp`)
**Verified Units:** Meters (`m`)
**Missing Values:** 0
**Accumulation:** ERA5 `tp` is represented as depth accumulated over the preceding forecast step. Conversion to mm requires a factor of 1000. Aggregation to daily resolution will require a rolling sum over 24 steps (taking UTC vs IST offsets into account).

## 7. Conclusion

The weather (ERA5) and terrain (GLO-30 DEM) layers are strictly validated, fully populated, and scientifically suitable for preprocessing. ERA5's 0.25° resolution proves it is a **coarse input layer**, meaning it must not be substituted for final Panchayat-level ground truth.

The pipeline is technically ready for Phase 5 (Preprocessing), blocked entirely by the missing Gram Panchayat polygon boundaries.
