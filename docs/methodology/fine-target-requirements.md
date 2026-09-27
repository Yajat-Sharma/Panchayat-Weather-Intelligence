# Fine-Target Requirements for Panchayat-Level Weather Downscaling

Our Phase 4 and Phase 5 scientific validation definitively proved that the ERA5 Total Precipitation dataset (0.25° grid, ~700 sq km per cell) is a **coarse input**. The average Pune Gram Panchayat is approximately 10 sq km. Consequently, using ERA5 directly as the "ground truth" to measure the accuracy of a downscaling model is scientifically invalid. 

To train and evaluate a downscaling ML model correctly, we must select an independent, fine-resolution meteorological dataset to serve as the **target**.

## Mandatory Requirements for the Fine Target

1. **Finer Spatial Resolution:** 
   - The target must have a spatial resolution significantly finer than ERA5 (0.25°).
   - Ideally, the resolution should approach the Panchayat scale (e.g., 1 km to 5 km grid spacing, or ~0.01° to 0.05°).
2. **Sufficient Temporal Coverage:** 
   - Must provide daily precipitation totals for the exact temporal window matching our ERA5 inputs (Year 2023).
3. **Panchayat / Study Area Coverage:** 
   - Must cover the entire Pune district (at least `17.0°N–20.0°N, 72.5°E–75.5°E`).
4. **Independent / Appropriately Treated Source:** 
   - The dataset must ideally incorporate independent ground observations (rain gauges) rather than purely re-interpolating another coarse reanalysis dataset. 
5. **Meteorological Variable:** 
   - Must provide Total Precipitation (consistent accumulation semantics).
6. **Reproducible Access:** 
   - The dataset must be publicly accessible via programmatic download or clearly documented open data portals.
7. **Sufficient Spatial Variability:** 
   - The target must demonstrate localized variance across neighboring Panchayats to effectively evaluate the downscaling model's ability to learn topographic effects.

## Candidate Target Datasets

### 1. IMD Gridded Rainfall Data (0.25° or 0.1°)
- **Pros:** Incorporates authoritative ground rain gauges from the Indian Meteorological Department.
- **Cons:** Standard product is 0.25° (same as ERA5). The high-resolution 0.1° (~11 km) product is better, but still larger than an average Panchayat (10 sq km vs 121 sq km).

### 2. CHIRPS (Climate Hazards Group InfraRed Precipitation with Station data)
- **Pros:** 0.05° resolution (~5.5 km grid, roughly 30 sq km per cell). Integrates satellite imagery and ground station data. Covers 2023.
- **Cons:** Primarily designed for drought monitoring; performance in heavy monsoon regimes requires verification.

### 3. GPM IMERG (Global Precipitation Measurement)
- **Pros:** 0.1° resolution (~11 km grid). High temporal frequency (half-hourly to daily).
- **Cons:** Resolution is still an order of magnitude larger than a Panchayat.

### 4. Maharashtra MahaTAHA / AWS Network Data
- **Pros:** Direct Automatic Weather Station point observations at the village/mandal level. Represents true localized ground truth.
- **Cons:** Point data requires spatial interpolation (e.g., Kriging) to produce a continuous target surface for the Panchayats, introducing interpolation artifacts. Data access may require manual portal navigation.

## Conclusion & Next Step
For Phase 6, we must evaluate and integrate one of these high-resolution datasets (such as **CHIRPS at 0.05°** or an **IMD 0.1°** product) to serve as the authentic target variable for the XGBoost model. Training on ERA5 to predict ERA5 will only yield trivial baseline replication.
