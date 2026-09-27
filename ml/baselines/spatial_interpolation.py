import pandas as pd
import geopandas as gpd
from scipy.spatial import KDTree
import numpy as np

class NearestNeighborBaseline:
    """Nearest neighbor spatial interpolation baseline."""
    
    def fit(self, source_points: gpd.GeoDataFrame, variable: str):
        self.variable = variable
        self.source_points = source_points.copy()
        
        # Ensure source points are points
        if not all(self.source_points.geometry.type == 'Point'):
            self.source_points.geometry = self.source_points.centroid
            
        # Build KDTree using projected coordinates for accurate nearest neighbor
        self.proj_source = self.source_points.to_crs("EPSG:32643")
        self.tree = KDTree(np.array(list(zip(self.proj_source.geometry.x, self.proj_source.geometry.y))))
        
    def predict(self, target_polygons: gpd.GeoDataFrame) -> pd.DataFrame:
        target_centroids = target_polygons.copy()
        target_centroids.geometry = target_centroids.centroid
        proj_targets = target_centroids.to_crs("EPSG:32643")
        
        target_coords = np.array(list(zip(proj_targets.geometry.x, proj_targets.geometry.y)))
        distances, indices = self.tree.query(target_coords)
        
        predictions = self.source_points.iloc[indices][self.variable].values
        
        result = pd.DataFrame({
            'panchayat_id': target_polygons.index if 'id' not in target_polygons.columns else target_polygons['id'],
            f'{self.variable}_pred': predictions
        })
        return result

class BilinearBaseline:
    """Bilinear interpolation baseline (Stub for grid-based interpolation)."""
    def fit(self, source_grid, variable: str):
        # TODO: Implement rasterio/scipy grid interpolation
        pass
    def predict(self, target_polygons: gpd.GeoDataFrame) -> pd.DataFrame:
        pass

