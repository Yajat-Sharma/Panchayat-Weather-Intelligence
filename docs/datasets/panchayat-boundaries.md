# Pune Gram Panchayat Boundaries

This dataset represents the authoritative spatial geometries for Gram Panchayats in the Pune district.

## Data Provenance
- **Source:** Ministry of Panchayati Raj / NIC (Gram Manchitra)
- **Official/Secondary Status:** OFFICIAL (Extracted directly from Government ArcGIS REST Layer 3)
- **REST Service URL:** `https://grammanchitragis.nic.in/grammanchitra/rest/services/panchayat/panchayat_admin/MapServer/3`
- **Query Filter Used:** `UPPER(stname) = 'MAHARASHTRA' AND UPPER(dtname) = 'PUNE'`
- **Acquisition Date:** 2026-09-27
- **Dataset Version/Date:** Current as of 2026-09 (Administrative vintage varies)
- **Number of Panchayats Extracted:** 1,545
- **Comparison to Zilla Parishad Count:** The official Zilla Parishad website states there are 1,386 GPs. The NIC service returns 1,545 polygons. The discrepancy of 159 likely arises from recent administrative divisions, municipal integrations not yet reflected in the parent list, or duplicate/historical geometries retained in the GIS layer. The downloaded 1,545 geometries act as the spatial truth.
- **CRS:** Downloaded in EPSG:4326 (WGS 84), Reprojected to EPSG:32643 (UTM Zone 43N) for area calculations.
- **Geometry Type:** Polygon / MultiPolygon
- **Fields Retained:** `stname`, `dtname`, `blkname`, `GPCODE`, `GPNAME`, `OBJECTID` and other administrative LGD IDs.

## Spatial Statistics (Calculated mathematically)
- **Count:** 1,545
- **Minimum Area:** ~0.00 sq km (indicating possible slivers/artifacts in government geometry)
- **Mean Area:** 10.13 sq km
- **Median Area:** 7.85 sq km
- **P90 Area:** 19.55 sq km
- **Maximum Area:** 159.23 sq km

## Scientific Resolution Check against ERA5
- The average Gram Panchayat is **~10 sq km**.
- The standard ERA5 grid cell (0.25°) is **~700 sq km**.
- **Conclusion:** ERA5 is confirmed mathematically as a coarse input layer. Downscaling is strictly required to achieve Panchayat-level fidelity.

## Coverage Overlaps
- **DEM:** 1545 / 1545 (100% covered)
- **ERA5 Bounding Box:** 1514 / 1545 (31 Panchayats lie just outside the standard ERA5 18-19.5, 73-75 crop bounds. This indicates the study area box for ERA5 could be slightly expanded in the future).

## Known Limitations
The presence of 0.00 sq km geometries indicates minor digitization errors in the official dataset. Additionally, 31 Panchayats fall outside the currently downloaded ERA5 bounding box.
