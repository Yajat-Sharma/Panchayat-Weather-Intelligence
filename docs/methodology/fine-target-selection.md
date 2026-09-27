# Fine-Resolution Target Selection for Panchayat Downscaling

## 1. Objective
The current coarse weather input is **ERA5** at `0.25° x 0.25°` resolution (~27 km x 26 km at Pune's latitude, or ~700 sq km per grid cell). Since the average Gram Panchayat is ~10 sq km, ERA5 cannot serve as the ground truth for Panchayat-level rainfall. To validate our downscaling models mathematically, we require an independent, fine-resolution target dataset.

## 2. Minimum Requirements
1. **Coverage**: Must fully cover Pune District, Maharashtra.
2. **Temporal Coverage**: Must be fully available for the year 2023.
3. **Variable**: Clearly defined daily precipitation.
4. **Resolution**: Must be significantly finer than 0.25°.
5. **Reproducibility**: Must be accessible via stable programmatic URLs without manual GUI intervention.

## 3. Candidate Evaluation

### Candidate A: IMD Gridded Rainfall (NetCDF)
- **Source**: India Meteorological Department (IMD) Pune
- **Resolution**: 0.25° x 0.25°
- **Temporal Frequency**: Daily
- **2023 Availability**: Yes
- **Access Method**: Direct HTTP download via IMD Pune server
- **Units**: mm/day
- **Strengths**: Official government gauge-interpolated data.
- **Limitations**: The resolution (0.25°) is mathematically identical to our coarse ERA5 input. It provides no spatial variance at the sub-grid (Panchayat) level relative to ERA5.
- **Suitability**: **REJECTED**. Not finer than the coarse input.

### Candidate B: GPM IMERG Final Run
- **Source**: NASA Goddard Earth Sciences Data and Information Services Center (GES DISC)
- **Resolution**: 0.1° x 0.1° (~10 km x 10 km)
- **Temporal Frequency**: Daily (aggregated from half-hourly)
- **2023 Availability**: Yes
- **Access Method**: HTTPS via Earthdata Login (requires registered credentials)
- **Units**: mm/day
- **Strengths**: High-quality satellite-gauge fusion.
- **Limitations**: 0.1° is still roughly ~100 sq km, which means ~10 Panchayats fit in one grid cell. Additionally, programmatic download requires Earthdata credentials and `.netrc` configuration which complicates automated reproducibility without secret management.
- **Suitability**: **REJECTED**. Moderate resolution improvement, high access friction.

### Candidate C: CHIRPS v2.0 (Climate Hazards Group InfraRed Precipitation with Station data)
- **Source**: UC Santa Barbara Climate Hazards Center (CHC)
- **Resolution**: 0.05° x 0.05° (~5.5 km x 5.5 km at equator, roughly 25-30 sq km per grid cell)
- **Temporal Frequency**: Daily
- **2023 Availability**: Yes (Final version)
- **Access Method**: Direct unauthenticated HTTP/FTP download of NetCDF files (e.g., `chirps-v2.0.2023.days_p05.nc`)
- **Units**: mm/day
- **Strengths**: 
  - Substantial resolution improvement (25x finer area than ERA5).
  - Explicitly blends satellite infrared data with station data, providing independent spatial structure from ERA5.
  - Zero-friction programmatic download (no tokens/logins required).
  - NetCDF format natively supported by `xarray` and `rasterstats`.
- **Limitations**: 0.05° is still slightly larger than the smallest Panchayats, meaning some adjacent small Panchayats may share the same pixel. However, it is the highest-resolution, freely available, daily gridded product globally.
- **Suitability**: **ACCEPTED**.

## 4. Final Selected Target
**CHIRPS v2.0 Daily Precipitation (0.05°)**

### Scientific Justification
CHIRPS provides a 0.05° spatial grid, which represents a 25-fold increase in spatial granularity compared to ERA5 (0.25°). This provides the necessary fine-scale variance across the 1,545 Pune Gram Panchayats to evaluate the XGBoost downscaling model. Because it is an independent satellite-gauge product, it avoids circular leakage (where the target is merely a resampled version of the input). Furthermore, its unauthenticated open HTTP access guarantees 100% reproducibility in our automated pipeline.
