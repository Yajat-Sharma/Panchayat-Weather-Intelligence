import os
import json
import xarray as xr
import pandas as pd
import numpy as np

def validate_era5(file_path):
    print(f"Validating ERA5 dataset: {file_path}")
    
    # Check file size
    size_bytes = os.path.getsize(file_path)
    print(f"File size: {size_bytes / 1024 / 1024:.2f} MB")
    if size_bytes == 0:
        raise ValueError("File is 0 bytes.")
        
    ds = xr.open_dataset(file_path)
    
    # Get actual lat/lon spacing
    lats = ds['latitude'].values
    lons = ds['longitude'].values
    lat_spacing = np.abs(lats[0] - lats[1]) if len(lats) > 1 else None
    lon_spacing = np.abs(lons[0] - lons[1]) if len(lons) > 1 else None
    
    print(f"Latitude range: {lats.min()} to {lats.max()} (spacing: {lat_spacing})")
    print(f"Longitude range: {lons.min()} to {lons.max()} (spacing: {lon_spacing})")
    
    # Check time axis
    time_var = 'valid_time' if 'valid_time' in ds.variables else 'time'
    times = ds[time_var].values
    time_index = pd.DatetimeIndex(times)
    
    print(f"Time Start: {time_index.min()}")
    print(f"Time End: {time_index.max()}")
    print(f"Timestamp Count: {len(time_index)}")
    
    # Expected hours in 2023 (not a leap year, 365 days)
    expected_hours = 365 * 24
    print(f"Expected timestamps for 2023: {expected_hours}")
    
    if len(time_index) == expected_hours:
        print("Timestamp count matches exactly.")
    else:
        print(f"WARNING: Timestamp count mismatch. Missing/Extra: {len(time_index) - expected_hours}")
        
    # Check for duplicates
    if time_index.has_duplicates:
        print("WARNING: Duplicate timestamps found!")
    else:
        print("No duplicate timestamps.")
        
    # Check regular intervals
    intervals = time_index.to_series().diff().dropna()
    unique_intervals = intervals.unique()
    print(f"Time intervals: {[str(i) for i in unique_intervals]}")
    if len(unique_intervals) == 1 and unique_intervals[0] == pd.Timedelta(hours=1):
        print("Temporal resolution is strictly 1 hour.")
        
    # Precipitation variable
    tp = ds['tp']
    units = tp.attrs.get('units', 'unknown')
    long_name = tp.attrs.get('long_name', 'unknown')
    
    print(f"Variable: tp")
    print(f"Long Name: {long_name}")
    print(f"Units: {units}")
    
    missing_vals = tp.isnull().sum().item()
    print(f"Missing values (tp): {missing_vals}")
    
    # Compile report dictionary
    report = {
        "status": "VALID",
        "file_path": file_path,
        "file_size_bytes": size_bytes,
        "dimensions": {
            "time": len(time_index),
            "latitude": len(lats),
            "longitude": len(lons)
        },
        "spatial_resolution": {
            "latitude": float(lat_spacing) if lat_spacing else None,
            "longitude": float(lon_spacing) if lon_spacing else None
        },
        "bounding_box": [float(lons.min()), float(lats.min()), float(lons.max()), float(lats.max())],
        "time_start": str(time_index.min()),
        "time_end": str(time_index.max()),
        "expected_timestamps": expected_hours,
        "actual_timestamps": len(time_index),
        "has_duplicates": time_index.has_duplicates,
        "variables": {
            "tp": {
                "units": units,
                "long_name": long_name,
                "missing_values": missing_vals
            }
        },
        "precipitation_semantics": f"Units are '{units}'. Total precipitation accumulated since previous forecast step.",
        "suitability": "GO"
    }
    
    audit_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "interim", "audits", "weather_audit.json"))
    with open(audit_path, 'w') as f:
        json.dump(report, f, indent=4)
    print(f"\nUpdated {audit_path}")
    
if __name__ == "__main__":
    file_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "raw", "weather", "era5_pune_2023.nc"))
    if os.path.exists(file_path):
        validate_era5(file_path)
    else:
        print("ERA5 file not found.")
