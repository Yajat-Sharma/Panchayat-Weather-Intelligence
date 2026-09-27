import os
import json
import numpy as np
import geopandas as gpd
import rasterio
import xarray as xr
from shapely.geometry import box

def validate_panchayats(boundary_path, dem_path, weather_path):
    print(f"Validating Gram Panchayats from: {boundary_path}")
    
    if not os.path.exists(boundary_path) or os.path.getsize(boundary_path) == 0:
        print("ERROR: Boundary file is missing or 0 bytes.")
        return False
        
    try:
        gdf = gpd.read_file(boundary_path)
    except Exception as e:
        print(f"ERROR: Failed to read GeoJSON/Shapefile. {e}")
        return False
        
    # Check if empty geometries exist
    empty_geom_count = gdf.geometry.is_empty.sum()
    if empty_geom_count > 0:
        print(f"WARNING: Found {empty_geom_count} empty geometries.")
        
    # Check original CRS
    print(f"Original CRS: {gdf.crs}")
    if gdf.crs is None:
        print("WARNING: Dataset is missing CRS. Assuming EPSG:4326.")
        gdf.set_crs(epsg=4326, inplace=True)
        
    # Reproject to UTM Zone 43N (EPSG:32643) for area calculation
    print("Reprojecting to UTM Zone 43N (EPSG:32643) for accurate area calculations...")
    gdf_utm = gdf.to_crs(epsg=32643)
    
    # Calculate Areas
    areas_sqkm = gdf_utm.geometry.area / 1e6
    stats = {
        "count": len(gdf),
        "area_min_sqkm": float(areas_sqkm.min()),
        "area_max_sqkm": float(areas_sqkm.max()),
        "area_mean_sqkm": float(areas_sqkm.mean()),
        "area_median_sqkm": float(areas_sqkm.median()),
        "area_p25_sqkm": float(areas_sqkm.quantile(0.25)),
        "area_p75_sqkm": float(areas_sqkm.quantile(0.75)),
        "area_p90_sqkm": float(areas_sqkm.quantile(0.90)),
        "area_p95_sqkm": float(areas_sqkm.quantile(0.95))
    }
    
    print("\n--- PUNE GRAM PANCHAYAT STATISTICS ---")
    print(f"Total Count: {stats['count']} (Official Zilla Parishad count: 1386)")
    if stats['count'] != 1386:
        print(f"WARNING: Count discrepancy of {abs(stats['count'] - 1386)}")
    
    print(f"Area Min: {stats['area_min_sqkm']:.2f} sq km")
    print(f"Area Max: {stats['area_max_sqkm']:.2f} sq km")
    print(f"Area Mean: {stats['area_mean_sqkm']:.2f} sq km")
    print(f"Area Median: {stats['area_median_sqkm']:.2f} sq km")
    print(f"Area P25: {stats['area_p25_sqkm']:.2f} sq km")
    print(f"Area P75: {stats['area_p75_sqkm']:.2f} sq km")
    print(f"Area P90: {stats['area_p90_sqkm']:.2f} sq km")
    print(f"Area P95: {stats['area_p95_sqkm']:.2f} sq km")
    
    # Check Overlaps
    print("\n--- SPATIAL OVERLAP CHECKS ---")
    gdf_wgs = gdf.to_crs(epsg=4326)
    
    # DEM overlap
    if os.path.exists(dem_path) and os.path.getsize(dem_path) > 0:
        with rasterio.open(dem_path) as src:
            dem_bounds = src.bounds
            dem_box = box(*dem_bounds)
            dem_gdf = gpd.GeoDataFrame(geometry=[dem_box], crs=4326)
            
            intersect_dem = gdf_wgs.intersects(dem_box)
            print(f"Panchayats inside DEM coverage: {intersect_dem.sum()} / {stats['count']}")
    
    # ERA5 Overlap
    if os.path.exists(weather_path) and os.path.getsize(weather_path) > 0:
        ds = xr.open_dataset(weather_path)
        lat_var = 'latitude' if 'latitude' in ds.coords else 'lat'
        lon_var = 'longitude' if 'longitude' in ds.coords else 'lon'
        
        lats = ds[lat_var].values
        lons = ds[lon_var].values
        
        era5_box = box(lons.min(), lats.min(), lons.max(), lats.max())
        intersect_era5 = gdf_wgs.intersects(era5_box)
        print(f"Panchayats inside ERA5 coverage: {intersect_era5.sum()} / {stats['count']}")
        
        era_lat_step = np.abs(lats[0] - lats[1])
        era_lon_step = np.abs(lons[0] - lons[1])
        print(f"\nERA5 Grid size: {era_lon_step}° x {era_lat_step}°")
        
        # Approximate area of 0.25 deg at 18N is ~27km x ~26km = 702 sq km
        print("SCIENTIFIC CONCLUSION:")
        print(f"Average Panchayat Area: {stats['area_mean_sqkm']:.2f} sq km")
        print("Average ERA5 Grid Cell Area: ~700 sq km")
        print("ERA5 is mathematically a COARSE INPUT compared to the Panchayat target size.")
    
    # Save audit
    report = {
        "status": "VALID",
        "file_path": boundary_path,
        "crs": str(gdf.crs),
        "empty_geometries": int(empty_geom_count),
        "statistics": stats
    }
    
    audit_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "interim", "audits", "boundary_audit.json"))
    os.makedirs(os.path.dirname(audit_path), exist_ok=True)
    with open(audit_path, 'w') as f:
        json.dump(report, f, indent=4)
        
    print(f"\nAudit saved to {audit_path}")
    return True

if __name__ == "__main__":
    base = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    boundary = os.path.join(base, "data", "raw", "boundaries", "pune_panchayats.geojson")
    dem = os.path.join(base, "data", "raw", "terrain", "pune_dem.tif")
    weather = os.path.join(base, "data", "raw", "weather", "era5_pune_2023.nc")
    
    validate_panchayats(boundary, dem, weather)
