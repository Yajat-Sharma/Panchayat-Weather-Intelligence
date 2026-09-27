import pandas as pd
import numpy as np

class FeatureBuilder:
    """Builds features and targets for the downscaling experiment without leakage."""
    
    def __init__(self):
        pass
        
    def build(self, fine_gdf, coarse_gdf, variable='true_precip'):
        """
        Merges fine and coarse data to construct X and Y.
        """
        # Spatially join coarse predictions to fine points based on distance (or block assignment)
        # Since coarse_gdf has 'coarse_x_idx' and 'coarse_y_idx', we merge on those if available,
        # otherwise we can do a spatial join. Our SpatialAggregator created these indices.
        
        if 'coarse_x_idx' in fine_gdf.columns and 'coarse_x_idx' in coarse_gdf.columns:
            merged = pd.merge(
                fine_gdf, 
                coarse_gdf[['valid_time', 'coarse_x_idx', 'coarse_y_idx', f'coarse_{variable}']], 
                on=['valid_time', 'coarse_x_idx', 'coarse_y_idx'], 
                how='left'
            )
        else:
            # Fallback to a simple spatial nearest join if block indices are missing
            raise NotImplementedError("Spatial join fallback not implemented. Ensure indices exist.")
            
        # Build X
        X = pd.DataFrame()
        X['coarse_val'] = merged[f'coarse_{variable}']
        X['lat'] = merged.geometry.y
        X['lon'] = merged.geometry.x
        X['elevation'] = merged['elevation']
        X['day_of_year'] = merged['valid_time'].dt.dayofyear
        
        # Build Y
        Y = merged[variable]
        
        return X, Y, merged
