# Pune Gram Panchayat Count Reconciliation

This document formally records the discrepancy between spatial geometries and official administrative counts for the Gram Panchayats in Pune District.

## Official Counts
- **Pune Zilla Parishad Count:** 1,386 Gram Panchayats (Source: Pune ZP official website).
- **NIC Gram Manchitra (ArcGIS REST Layer 3) Spatial Count:** 1,545 Polygons.

## Discrepancy Analysis
The spatial query returned an excess of **159** geometries compared to the current Zilla Parishad count.

### What is Known:
- The downloaded dataset contains 1,545 distinct spatial features (no exact spatial duplicates).
- 194 records share duplicate `GPCODE` identifiers.
- 2 polygons have an extremely small physical area (<0.01 sq km).
- All 1,545 polygons have valid geometries after buffering, with no null or empty shapes.

### Possible Explanations for Discrepancy:
1. **MultiPolygon Split:** A single administrative Gram Panchayat may be physically disjointed (e.g., separated by a river or another administrative boundary), resulting in multiple distinct polygons sharing the same `GPCODE`. This would explain why there are 194 duplicate GPCODEs while having unique spatial geometries.
2. **Administrative Vintage:** The NIC GIS layer may retain historical polygons of Panchayats that have recently merged, been absorbed into municipal corporations (like PMC/PCMC), or split. 
3. **Digitization Artifacts:** Extremely small sliver polygons (like the 2 found under 0.01 sq km) often occur during GIS digitization when neighboring administrative boundaries do not perfectly snap together.

## Resolution for ML Pipeline
- **We do NOT force the dataset down to 1,386.** 
- The 1,545 spatial features (stored in `data/interim/boundaries/pune_panchayats_valid.geojson`) are preserved as the definitive spatial truth for extracting meteorological features. 
- For spatial downscaling, physical geometry governs the weather extraction, not the administrative roll. If multiple polygons form a single Panchayat (duplicate GPCODEs), they can be grouped analytically later if a purely tabular output is requested.
