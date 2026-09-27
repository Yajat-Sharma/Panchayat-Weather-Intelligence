import pytest
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point
from ml.experiments.aggregation import SyntheticDataGenerator, SpatialAggregator
from ml.features.builder import FeatureBuilder
from ml.models.xgboost_residual import XGBoostResidualDownscaler
from ml.baselines.spatial_interpolation import NearestNeighborBaseline

@pytest.fixture
def synthetic_data():
    bounds = (73.0, 18.0, 74.0, 19.0) # 1 degree box
    dates = pd.date_range(start="2023-07-01", periods=2) # 2 days
    gen = SyntheticDataGenerator(bounds, fine_resolution_deg=0.1) # 10x10 points
    return gen.generate_historical_field(dates)

def test_spatial_aggregator(synthetic_data):
    agg = SpatialAggregator(aggregation_factor=5)
    coarse = agg.aggregate(synthetic_data, variable='true_precip')
    
    # 10x10 grid with factor 5 should yield 2x2 = 4 coarse points per day. Total 8.
    assert len(coarse) == 8
    assert 'coarse_true_precip' in coarse.columns
    assert 'coarse_x_idx' in coarse.columns

def test_feature_builder(synthetic_data):
    agg = SpatialAggregator(aggregation_factor=5)
    coarse = agg.aggregate(synthetic_data, variable='true_precip')
    
    builder = FeatureBuilder()
    X, Y, merged = builder.build(synthetic_data, coarse, variable='true_precip')
    
    assert len(X) == len(synthetic_data)
    assert 'coarse_val' in X.columns
    assert 'elevation' in X.columns
    assert len(Y) == len(synthetic_data)

def test_xgboost_residual():
    # Setup dummy data
    X = pd.DataFrame({
        'coarse_val': [10, 20, 30],
        'elevation': [100, 200, 300]
    })
    Y = pd.Series([12, 18, 35])
    baseline_preds = pd.Series([10, 20, 30])
    
    model = XGBoostResidualDownscaler({'n_estimators': 1, 'max_depth': 2})
    model.fit(X, Y, baseline_preds)
    
    preds = model.predict(X, baseline_preds)
    assert len(preds) == 3
    # Should be non-negative
    assert all(preds >= 0)
