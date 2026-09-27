# Real Data Acquisition

This document outlines the required datasets, their sources, and the procedure to download them for the Real Meteorological Data Validation experiment (Phase 4).

## 1. Real Weather Data (Reanalysis)
- **Dataset:** ERA5 (Fifth generation of ECMWF atmospheric reanalyses)
- **Source:** Copernicus Climate Data Store (CDS)
- **Official URL:** https://cds.climate.copernicus.eu/
- **Access Requirements:** Requires a free CDS account and API key.
- **File Format:** NetCDF (`.nc`)
- **Expected Variable:** Total Precipitation (`tp`), daily or hourly sum.
- **Resolution:** 0.1° x 0.1° (~9 km)
- **Temporal Coverage:** 1 full year (e.g., 2023) to capture a complete monsoon cycle.
- **License:** Copernicus open data license.
- **Download Procedure:** Use the `cdsapi` Python package or download manually via the web interface for the bounding box of Pune (approx `N: 19.4`, `S: 17.9`, `W: 73.3`, `E: 75.2`).
- **Expected Local Filename:** `data/raw/weather/era5_pune_2023.nc`

## 2. Real Panchayat Boundaries
- **Dataset:** Administrative Boundaries (Panchayats)
- **Source:** DataMeet (GitHub) or Survey of India (SoI).
- **Official URL:** https://github.com/datameet/maps (Unverified for exact Panchayat level)
- **Access Requirements:** Publicly available / Open Data.
- **File Format:** GeoJSON or Shapefile (`.shp`).
- **Expected Variable:** Polygon geometries for Panchayats.
- **License:** Various open licenses.
- **Download Procedure:** Download the state-level or national shapefile and filter for Pune district (`district == "Pune"`).
- **Expected Local Filename:** `data/raw/boundaries/pune_panchayats.geojson`

## 3. Real DEM (Terrain)
- **Dataset:** Copernicus DEM (GLO-30) or SRTM (Shuttle Radar Topography Mission)
- **Source:** AWS Open Data Registry or USGS EarthExplorer
- **Official URL:** https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model
- **Access Requirements:** Public/Open.
- **File Format:** GeoTIFF (`.tif`).
- **Resolution:** ~30 meters.
- **License:** Open data.
- **Download Procedure:** Download the tiles covering the Pune bounding box and merge them if necessary, or fetch directly using `rasterio` over HTTPs.
- **Expected Local Filename:** `data/raw/terrain/pune_dem.tif`

## Note on Terminology
- **ERA5 / AgERA5** must strictly be referred to as *Reanalysis* data. It is NOT a historical operational forecast.
- **IMD Block-level Forecasts** are *operational forecasts*. We will only claim forecast downscaling if actual IMD archives are acquired and validated.
