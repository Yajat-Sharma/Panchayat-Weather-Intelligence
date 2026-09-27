from abc import ABC, abstractmethod
import pandas as pd
import geopandas as gpd

class WeatherDataProvider(ABC):
    """Abstract base class for fetching coarse weather forecasts (e.g., IMD Block-level, ERA5)."""
    @abstractmethod
    def fetch_forecast(self, bounding_box: tuple, start_time: str, end_time: str) -> pd.DataFrame:
        pass

class ObservationProvider(ABC):
    """Abstract base class for fetching ground truth weather observations (e.g., AWS, ARG)."""
    @abstractmethod
    def fetch_observations(self, bounding_box: tuple, start_time: str, end_time: str) -> pd.DataFrame:
        pass

class BoundaryProvider(ABC):
    """Abstract base class for fetching administrative boundaries (District, Block, Panchayat)."""
    @abstractmethod
    def fetch_panchayats(self, district_id: str) -> gpd.GeoDataFrame:
        pass

class TerrainProvider(ABC):
    """Abstract base class for fetching terrain features (Elevation, Slope, Aspect)."""
    @abstractmethod
    def fetch_terrain_stats(self, geometry: gpd.GeoSeries) -> pd.DataFrame:
        pass

class LandCoverProvider(ABC):
    """Abstract base class for fetching land cover fractions (Forest, Urban, Water, Crop)."""
    @abstractmethod
    def fetch_land_cover_stats(self, geometry: gpd.GeoSeries) -> pd.DataFrame:
        pass

class SatelliteProvider(ABC):
    """Abstract base class for fetching satellite estimates (e.g., INSAT rainfall)."""
    @abstractmethod
    def fetch_satellite_estimates(self, geometry: gpd.GeoSeries, timestamp: str) -> pd.DataFrame:
        pass
