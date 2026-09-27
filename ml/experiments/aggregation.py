import numpy as np
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point

class SyntheticDataGenerator:
    """Generates synthetic high-resolution weather fields for the controlled experiment."""
    
    def __init__(self, bounds: tuple, fine_resolution_deg: float = 0.05):
        """
        :param bounds: (minx, miny, maxx, maxy) e.g., (73.0, 18.0, 75.0, 20.0)
        :param fine_resolution_deg: Resolution of the high-res "truth" field (approx 5km)
        """
        self.bounds = bounds
        self.res = fine_resolution_deg
        
    def generate_historical_field(self, dates: pd.DatetimeIndex) -> gpd.GeoDataFrame:
        """Generates a synthetic spatial-temporal dataset with elevation-dependent rainfall."""
        minx, miny, maxx, maxy = self.bounds
        
        # Create a grid of points
        x_coords = np.arange(minx, maxx, self.res)
        y_coords = np.arange(miny, maxy, self.res)
        
        points = []
        for x in x_coords:
            for y in y_coords:
                # Synthetic terrain: elevation generally increases west to east in this dummy box,
                # with a random noise component
                elevation = 500 + (x - minx) * 1000 + np.random.normal(0, 50)
                points.append({'geometry': Point(x, y), 'elevation': max(0, elevation)})
                
        df_spatial = gpd.GeoDataFrame(points, crs="EPSG:4326")
        
        # Expand across time
        records = []
        for dt in dates:
            df_t = df_spatial.copy()
            df_t['valid_time'] = dt
            
            # Synthetic Precipitation Rule:
            # 1. Base rainfall depends on day of year (monsoon peak around day 200)
            doy = dt.dayofyear
            base_rain = max(0, 50 * np.sin(np.pi * (doy - 100) / 150))
            
            # 2. Orographic effect: more rain at higher elevations (with noise)
            orographic_multiplier = 1.0 + (df_t['elevation'] / 1000.0)
            
            # 3. Add random noise per point
            noise = np.random.normal(0, 5, len(df_t))
            
            df_t['true_precip'] = np.maximum(0, base_rain * orographic_multiplier + noise)
            records.append(df_t)
            
        return pd.concat(records, ignore_index=True)


class SpatialAggregator:
    """Aggregates high-resolution data to coarse fields to simulate reanalysis products."""
    
    def __init__(self, aggregation_factor: int = 5):
        """
        :param aggregation_factor: Number of fine grid cells per coarse grid cell (1D).
                                   e.g., factor=5 means a 5x5 block becomes 1 coarse cell.
        """
        self.factor = aggregation_factor
        
    def aggregate(self, fine_gdf: gpd.GeoDataFrame, variable: str, agg_method: str = 'mean') -> gpd.GeoDataFrame:
        """
        Aggregates the fine dataset to a coarse grid.
        Returns a GeoDataFrame of coarse points (centroids of the blocks) and aggregated variable.
        """
        df = fine_gdf.copy()
        df['x'] = df.geometry.x
        df['y'] = df.geometry.y
        
        # Determine unique x and y coordinates to build the block indices
        x_unique = np.sort(df['x'].unique())
        y_unique = np.sort(df['y'].unique())
        
        # Map each coordinate to a block index
        x_bins = x_unique[::self.factor]
        y_bins = y_unique[::self.factor]
        
        # Add a tiny epsilon to the max bin edge to include the rightmost/topmost points
        if len(x_bins) > 0: x_bins = np.append(x_bins, x_unique[-1] + 1e-5)
        if len(y_bins) > 0: y_bins = np.append(y_bins, y_unique[-1] + 1e-5)
        
        df['coarse_x_idx'] = np.digitize(df['x'], x_bins)
        df['coarse_y_idx'] = np.digitize(df['y'], y_bins)
        
        # Attach to the original fine_gdf so the FeatureBuilder can merge easily
        fine_gdf['coarse_x_idx'] = df['coarse_x_idx']
        fine_gdf['coarse_y_idx'] = df['coarse_y_idx']
        
        # Group by the block index and time to compute the aggregate
        group_cols = ['valid_time', 'coarse_x_idx', 'coarse_y_idx']
        
        if agg_method == 'mean':
            coarse = df.groupby(group_cols).agg({
                variable: 'mean',
                'x': 'mean', # Coarse centroid
                'y': 'mean'
            }).reset_index()
        else:
            raise ValueError(f"Unknown aggregation method: {agg_method}")
            
        coarse['geometry'] = coarse.apply(lambda row: Point(row['x'], row['y']), axis=1)
        coarse.rename(columns={variable: f'coarse_{variable}'}, inplace=True)
        
        return gpd.GeoDataFrame(coarse, crs=fine_gdf.crs)
