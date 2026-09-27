import xgboost as xgb
import numpy as np
import pandas as pd
from typing import Dict, Any

class XGBoostResidualDownscaler:
    """
    Learns the residual between a baseline interpolation and the true high-res value.
    """
    
    def __init__(self, params: Dict[str, Any] = None):
        self.params = params or {
            'objective': 'reg:squarederror',
            'max_depth': 4,
            'learning_rate': 0.1,
            'n_estimators': 100
        }
        self.model = xgb.XGBRegressor(**self.params)
        
    def fit(self, X: pd.DataFrame, Y: pd.Series, baseline_preds: pd.Series):
        """
        X: features
        Y: true fine-scale values
        baseline_preds: e.g. Nearest Neighbour predictions
        """
        # Target is the residual
        residual = Y - baseline_preds
        self.model.fit(X, residual)
        
    def predict(self, X: pd.DataFrame, baseline_preds: pd.Series) -> pd.Series:
        """
        Returns absolute predictions: Baseline + predicted residual
        """
        pred_residual = self.model.predict(X)
        # Prevent negative precipitation
        return np.maximum(0, baseline_preds + pred_residual)
        
    def feature_importances(self, feature_names=None):
        importances = self.model.feature_importances_
        if feature_names is not None:
            return {k: float(v) for k, v in zip(feature_names, importances)}
        return [float(v) for v in importances]
