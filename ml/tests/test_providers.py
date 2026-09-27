import pytest
import os
import pandas as pd
import geopandas as gpd
import xarray as xr
import numpy as np
from ml.data.providers import WeatherDataProvider, ObservationProvider, BoundaryProvider, TerrainProvider, LandCoverProvider, SatelliteProvider
from ml.data.adapters import ERA5Provider

class MockWeatherProvider(WeatherDataProvider):
    def fetch_forecast(self, bounding_box, start_time, end_time):
        return pd.DataFrame()

def test_weather_data_provider_interface():
    provider = MockWeatherProvider()
    df = provider.fetch_forecast((0, 0, 1, 1), "2023-01-01", "2023-01-02")
    assert isinstance(df, pd.DataFrame)

@pytest.fixture
def synthetic_era5_nc(tmp_path):
    nc_path = tmp_path / "era5_test.nc"
    
    times = pd.date_range("2023-01-01", "2023-01-03", freq="D")
    lats = np.array([19.5, 19.0, 18.5, 18.0])
    lons = np.array([73.0, 73.5, 74.0, 74.5, 75.0])
    
    data = np.random.rand(len(times), len(lats), len(lons))
    
    ds = xr.Dataset(
        data_vars=dict(
            tp=(["time", "latitude", "longitude"], data, {"units": "m", "long_name": "Total precipitation"})
        ),
        coords=dict(
            time=times,
            latitude=lats,
            longitude=lons
        )
    )
    
    ds.to_netcdf(nc_path)
    return str(nc_path)

def test_era5_provider(synthetic_era5_nc):
    provider = ERA5Provider(data_path=synthetic_era5_nc, variable="tp")
    
    # Bbox: (min_lon, min_lat, max_lon, max_lat)
    # We slice 73.5 to 74.5 lon, and 18.5 to 19.0 lat
    bbox = (73.5, 18.5, 74.5, 19.0)
    
    df = provider.fetch_forecast(bbox, "2023-01-01", "2023-01-02")
    
    assert len(df) > 0
    assert "source" in df.columns
    assert "value" in df.columns
    assert df["source"].iloc[0] == "ERA5"
    assert df["variable"].iloc[0] == "tp"
    assert df["unit"].iloc[0] == "m"
    
    # Check spatial bounds
    assert df["latitude"].min() >= 18.5
    assert df["latitude"].max() <= 19.0
    assert df["longitude"].min() >= 73.5
    assert df["longitude"].max() <= 74.5
