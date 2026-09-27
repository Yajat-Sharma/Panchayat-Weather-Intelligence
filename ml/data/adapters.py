import pandas as pd
from typing import Optional
import os
from .providers import WeatherDataProvider, ObservationProvider

class IMDProvider(WeatherDataProvider):
    """Adapter for IMD Block-level Forecasts."""
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key
        
    def fetch_forecast(self, bounding_box: tuple, start_time: str, end_time: str) -> pd.DataFrame:
        # TODO: Implement actual authenticated API call here when credentials are provided.
        # For now, return a standardized empty DataFrame following the weather schema.
        print("WARN: IMD API credentials not available. Returning empty standardized DataFrame.")
        return pd.DataFrame(columns=[
            'location_id', 'source', 'variable', 'value', 'unit',
            'forecast_issue_time', 'valid_time', 'spatial_resolution', 'temporal_resolution'
        ])

import xarray as xr
import datetime

class ERA5Provider(WeatherDataProvider):
    """Adapter for ERA5/AgERA5 Hindcasts."""
    def __init__(self, data_path: Optional[str] = None, variable: str = 'tp'):
        self.data_path = data_path
        self.variable = variable
        
    def fetch_forecast(self, bounding_box: tuple, start_time: str, end_time: str) -> pd.DataFrame:
        if not self.data_path or not os.path.exists(self.data_path):
            raise ValueError(f"ERA5 data path {self.data_path} not found. Real Data Validation is BLOCKED.")
            
        try:
            # Load NetCDF using xarray and subset
            ds = xr.open_dataset(self.data_path)
            
            # Identify coordinates flexibly
            lat_col = next((c for c in ['latitude', 'lat'] if c in ds.coords), None)
            lon_col = next((c for c in ['longitude', 'lon'] if c in ds.coords), None)
            time_col = next((c for c in ['time'] if c in ds.coords), None)
            
            if not all([lat_col, lon_col, time_col]):
                raise ValueError("Missing required coordinates (lat, lon, time).")
                
            if self.variable not in ds.data_vars:
                raise ValueError(f"Requested variable {self.variable} not found in {list(ds.data_vars.keys())}.")
            
            # Ensure latitude ordering for slicing (sometimes it's decreasing)
            lat_vals = ds[lat_col].values
            if lat_vals[0] > lat_vals[-1]:
                # decreasing latitude
                lat_slice = slice(bounding_box[3], bounding_box[1])
            else:
                lat_slice = slice(bounding_box[1], bounding_box[3])
                
            # Subset spatially and temporally
            ds_subset = ds.sel({
                lat_col: lat_slice,
                lon_col: slice(bounding_box[0], bounding_box[2]),
                time_col: slice(start_time, end_time)
            })
            
            df = ds_subset[[self.variable]].to_dataframe().reset_index()
            units = ds[self.variable].attrs.get('units', 'Unknown')
            
            # Normalize to contract
            result = pd.DataFrame({
                'source': 'ERA5',
                'variable': self.variable,
                'value': df[self.variable],
                'unit': units,
                'valid_time': df[time_col].dt.date, # Simplified to date
                'latitude': df[lat_col],
                'longitude': df[lon_col],
                'forecast_issue_time': pd.NaT,
            })
            return result
            
        except Exception as e:
            print(f"WARN: Failed to load ERA5 data: {e}")
            raise e

class ERA5Downloader:
    """Optional stub for CDS API downloading (no credentials committed)."""
    def download(self, bbox, year, output_path):
        import os
        api_key = os.getenv('CDSAPI_KEY')
        if not api_key:
            raise ValueError("CDSAPI_KEY not found in environment.")
        print(f"Would download ERA5 for {bbox} year {year} to {output_path}")

class AWSObservationProvider(ObservationProvider):
    """Adapter for IMD AWS/ARG observations."""
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key
        
    def fetch_observations(self, bounding_box: tuple, start_time: str, end_time: str) -> pd.DataFrame:
        # TODO: Implement authenticated API call.
        print("WARN: AWS API credentials not available. Returning empty standardized DataFrame.")
        return pd.DataFrame(columns=[
            'location_id', 'source', 'variable', 'value', 'unit',
            'observation_time', 'spatial_resolution', 'temporal_resolution'
        ])
