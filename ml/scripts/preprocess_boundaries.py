import geopandas as gpd
import os

def analyze_and_repair_boundaries():
    base = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    raw_path = os.path.join(base, "data", "raw", "boundaries", "pune_panchayats.geojson")
    
    print(f"Loading raw boundaries from {raw_path}")
    gdf = gpd.read_file(raw_path)
    
    # Analyze raw geometry
    total = len(gdf)
    invalid_count = (~gdf.geometry.is_valid).sum()
    empty_count = gdf.geometry.is_empty.sum()
    null_count = gdf.geometry.isnull().sum()
    
    # Calculate area to find zero-area or extremely small polygons
    gdf_utm = gdf.to_crs(epsg=32643)
    areas_sqkm = gdf_utm.geometry.area / 1e6
    zero_area_count = (areas_sqkm == 0).sum()
    small_area_count = (areas_sqkm < 0.01).sum() # Less than 1 hectare
    
    # Duplicate identifiers
    dup_ids = gdf.duplicated(subset=['GPCODE']).sum()
    dup_geom = gdf.geometry.duplicated().sum()
    
    print("--- GEOMETRY QUALITY REPORT ---")
    print(f"Total features: {total}")
    print(f"Invalid geometries: {invalid_count}")
    print(f"Empty geometries: {empty_count}")
    print(f"Null geometries: {null_count}")
    print(f"Zero-area geometries: {zero_area_count}")
    print(f"Extremely small (<0.01 sq km): {small_area_count}")
    print(f"Duplicate GPCODEs: {dup_ids}")
    print(f"Duplicate spatial geometries: {dup_geom}")
    
    # Repair
    print("\n--- REPAIRING GEOMETRIES ---")
    
    # 1. Fix invalids with buffer(0)
    gdf['geometry'] = gdf.geometry.buffer(0)
    
    # 2. Drop empty/null
    gdf_valid = gdf[~gdf.geometry.is_empty & ~gdf.geometry.isnull()].copy()
    
    print(f"Features after removing empty/null: {len(gdf_valid)}")
    
    # Save to interim
    out_dir = os.path.join(base, "data", "interim", "boundaries")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "pune_panchayats_valid.geojson")
    
    gdf_valid.to_file(out_path, driver="GeoJSON")
    print(f"Saved repaired boundaries to {out_path}")
    
if __name__ == "__main__":
    analyze_and_repair_boundaries()
