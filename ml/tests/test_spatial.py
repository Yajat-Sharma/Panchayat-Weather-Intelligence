import pytest
import geopandas as gpd
import pandas as pd
from shapely.geometry import Polygon, Point
import rasterio
from rasterio.transform import from_origin
import numpy as np
import os
from ml.preprocessing.spatial import validate_crs, extract_terrain_features, project_for_area_calculation
from ml.preprocessing.features import build_panchayat_features
from ml.baselines.spatial_interpolation import NearestNeighborBaseline

@pytest.fixture
def synthetic_polygons():
    # Two simple polygons in Pune region (approx 18.5 N, 73.8 E)
    p1 = Polygon([(73.8, 18.5), (73.9, 18.5), (73.9, 18.6), (73.8, 18.6)])
    p2 = Polygon([(73.9, 18.5), (74.0, 18.5), (74.0, 18.6), (73.9, 18.6)])
    
    gdf = gpd.GeoDataFrame({
        'id': [1, 2],
        'name': ['Panchayat A', 'Panchayat B'],
        'block_id': [101, 101],
        'district_id': [1001, 1001],
        'geometry': [p1, p2]
    }, crs="EPSG:4326")
    return gdf

@pytest.fixture
def synthetic_dem(tmp_path):
    # Create a simple 10x10 synthetic DEM raster overlapping the polygons
    raster_path = tmp_path / "synthetic_dem.tif"
    
    # 0.02 degree per pixel covering 73.8 to 74.0 and 18.5 to 18.7
    transform = from_origin(73.8, 18.7, 0.02, 0.02)
    
    # Elevation from 500m to 600m
    data = np.linspace(500, 600, 100).reshape((10, 10)).astype(rasterio.float32)
    
    with rasterio.open(
        raster_path,
        'w',
        driver='GTiff',
        height=10,
        width=10,
        count=1,
        dtype=data.dtype,
        crs='+proj=latlong',
        transform=transform,
    ) as dst:
        dst.write(data, 1)
        
    return str(raster_path)

def test_validate_crs(synthetic_polygons):
    # Test valid CRS remains unchanged
    validated = validate_crs(synthetic_polygons, "EPSG:4326")
    assert validated.crs == "EPSG:4326"
    
    # Test projection
    projected = project_for_area_calculation(synthetic_polygons)
    assert projected.crs == "EPSG:32643"

def test_extract_terrain_features(synthetic_polygons, synthetic_dem):
    p1_geom = synthetic_polygons.iloc[0].geometry
    stats = extract_terrain_features(p1_geom, synthetic_dem)
    
    assert 'elevation_mean' in stats
    assert stats['elevation_mean'] >= 100
    assert stats['elevation_max'] <= 600

def test_build_panchayat_features(synthetic_polygons):
    terrain_stats = [
        {"elevation_mean": 550.0, "elevation_min": 500.0, "elevation_max": 600.0, "elevation_std": 10.0},
        {"elevation_mean": 560.0, "elevation_min": 510.0, "elevation_max": 610.0, "elevation_std": 10.0}
    ]
    df = build_panchayat_features(synthetic_polygons, terrain_stats)
    
    assert len(df) == 2
    assert 'centroid_lat' in df.columns
    assert 'area_km2' in df.columns
    assert df.iloc[0]['elevation_mean'] == 550.0
    
def test_nearest_neighbor_baseline(synthetic_polygons):
    # Create coarse source points
    source_pts = gpd.GeoDataFrame({
        'rainfall': [10.0, 20.0]
    }, geometry=[Point(73.85, 18.55), Point(73.95, 18.55)], crs="EPSG:4326")
    
    baseline = NearestNeighborBaseline()
    baseline.fit(source_pts, 'rainfall')
    
    predictions = baseline.predict(synthetic_polygons)
    assert len(predictions) == 2
    assert 'rainfall_pred' in predictions.columns
    # p1 should match point 1 (10.0), p2 should match point 2 (20.0)
    assert predictions.iloc[0]['rainfall_pred'] == 10.0
    assert predictions.iloc[1]['rainfall_pred'] == 20.0
