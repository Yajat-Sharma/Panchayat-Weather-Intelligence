# Data Provenance

To maintain scientific integrity and reproducibility, all datasets ingested into this pipeline must be fully documented here.

## 1. Pilot District: Pune, Maharashtra
Pune was selected as the pilot district due to its high agricultural output, extreme topographical variance (ranging from the steep Western Ghats in the west to the flatter Deccan Plateau in the east), and significant intra-district rainfall variability.

### A. Panchayat Boundaries
- **Source:** Local Government GIS Portals / BharatMaps
- **Acquisition Date:** Placeholder (Currently using synthetic fixtures for testing)
- **Spatial Resolution:** Vector (Polygon)
- **CRS:** Varies, converted internally to EPSG:4326 for storage, EPSG:32643 for area calculation.

### B. Digital Elevation Model (DEM)
- **Source:** NASA SRTM 30m / USGS EarthExplorer
- **Acquisition Date:** Placeholder
- **Spatial Resolution:** 30 meters
- **CRS:** EPSG:4326

### C. Historical Weather Hindcasts (Coarse)
- **Source:** Copernicus Climate Data Store - ERA5 Reanalysis
- **Variables:** Total Precipitation, 2m Temperature
- **Acquisition Date:** Placeholder
- **Spatial Resolution:** 0.25° x 0.25° (~25km)

*Note: True IMD historical forecast archives are not publically available in a straightforward API format. As such, we use ERA5 hindcasts to conduct a "Historical Reconstruction / Hindcast Experiment".*
