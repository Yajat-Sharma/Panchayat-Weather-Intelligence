import geopandas as gpd
import os

base = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
boundary_path = os.path.join(base, "data", "raw", "boundaries", "pune_panchayats.geojson")
gdf = gpd.read_file(boundary_path)
bounds = gdf.total_bounds
print("Panchayats bounding box (minx, miny, maxx, maxy):", bounds)

# The ERA5 request bounding box (North, West, South, East)
# The current ERA5 crop is 19.5, 73.0, 18.0, 75.0
n, w, s, e = 19.5, 73.0, 18.0, 75.0

is_covered = (bounds[0] >= w) and (bounds[2] <= e) and (bounds[1] >= s) and (bounds[3] <= n)
print(f"Covered by existing ERA5? {is_covered}")

if not is_covered:
    import math
    buffer = 0.5
    new_n = math.ceil(bounds[3] * 10) / 10 + buffer
    new_s = math.floor(bounds[1] * 10) / 10 - buffer
    new_e = math.ceil(bounds[2] * 10) / 10 + buffer
    new_w = math.floor(bounds[0] * 10) / 10 - buffer
    print(f"Recommended ERA5 BBox (N, W, S, E) with {buffer} buffer:")
    print(f"[{new_n}, {new_w}, {new_s}, {new_e}]")
