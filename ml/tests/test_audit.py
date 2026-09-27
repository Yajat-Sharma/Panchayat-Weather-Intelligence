import pytest
import os
import json

def test_data_raw_directories_exist():
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    assert os.path.isdir(os.path.join(base, "data", "raw", "weather"))
    assert os.path.isdir(os.path.join(base, "data", "raw", "boundaries"))
    assert os.path.isdir(os.path.join(base, "data", "raw", "terrain"))

def test_weather_data_validity():
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    weather_path = os.path.join(base, "data", "raw", "weather", "era5_pune_2023.nc")
    
    # 1. File must exist
    assert os.path.exists(weather_path), f"Missing {weather_path}"
    
    # 2. File must not be empty
    size = os.path.getsize(weather_path)
    if size == 0:
        pytest.fail(f"Weather dataset {weather_path} is an empty placeholder (0 bytes).")
        
    # 3. If valid, we would check xr.open_dataset here
    import xarray as xr
    try:
        ds = xr.open_dataset(weather_path)
        assert 'latitude' in ds.coords or 'lat' in ds.coords
        assert 'longitude' in ds.coords or 'lon' in ds.coords
        assert 'time' in ds.coords or 'valid_time' in ds.coords
    except Exception as e:
        pytest.fail(f"Failed to read NetCDF: {e}")

def test_boundary_data_validity():
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    boundary_path = os.path.join(base, "data", "raw", "boundaries", "pune_panchayats.geojson")
    
    assert os.path.exists(boundary_path), f"Missing {boundary_path}"
    
    size = os.path.getsize(boundary_path)
    if size == 0:
        pytest.skip(f"Boundary dataset {boundary_path} is an empty placeholder (0 bytes). Blocked on data acquisition.")
        
    import geopandas as gpd
    try:
        gdf = gpd.read_file(boundary_path)
        assert len(gdf) > 0
    except Exception as e:
        pytest.fail(f"Failed to read GeoJSON: {e}")

def test_dem_data_validity():
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    dem_path = os.path.join(base, "data", "raw", "terrain", "pune_dem.tif")
    
    assert os.path.exists(dem_path), f"Missing {dem_path}"
    
    size = os.path.getsize(dem_path)
    if size == 0:
        pytest.fail(f"DEM dataset {dem_path} is an empty placeholder (0 bytes).")
        
    import rasterio
    try:
        with rasterio.open(dem_path) as src:
            assert src.width > 0
    except Exception as e:
        pytest.fail(f"Failed to read GeoTIFF: {e}")
