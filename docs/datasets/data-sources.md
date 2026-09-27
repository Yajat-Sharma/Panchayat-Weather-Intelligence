# Data Sources

This document outlines the planned data sources for the weather downscaling pipeline.

## 1. Coarse Forecasts
- **IMD Block-level Forecasts:** The primary source for official block/district-level forecasts.
- **ERA5 / AgERA5 (ECMWF):** High-resolution global atmospheric reanalysis data, useful for historical training and baseline comparisons.

## 2. Terrain & Geospatial Data
- **Elevation (DEM):** SRTM (Shuttle Radar Topography Mission) at 30m resolution. Provides base elevation, from which slope and aspect are derived.
- **Land Cover:** ESA WorldCover (10m resolution). Used to calculate the fractional area of forests, water bodies, urban areas, and croplands within a Panchayat.
- **Boundaries:** Official government shapefiles/GeoJSONs for District, Block, and Panchayat boundaries.

## 3. Local Observations (Ground Truth)
- **IMD AWS/ARG:** Automatic Weather Stations and Automatic Rain Gauges. These provide high-confidence ground truth but are spatially sparse.
- **Satellite Estimates:** INSAT-3D/3DR derived rainfall, or GSMaP, to supplement ground observations in data-sparse regions.

*Note: All data ingestion must pass through the abstracted `Provider` interfaces in the ML pipeline. No direct hard-coded API calls should be placed in the core modeling logic.*
