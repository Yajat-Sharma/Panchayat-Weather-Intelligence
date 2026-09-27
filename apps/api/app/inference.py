import os
import json
import xgboost as xgb
import pandas as pd
import numpy as np
from datetime import datetime

class WeatherDownscaler:
    def __init__(self, model_path: str):
        self.model = xgb.XGBRegressor()
        self.metadata = {}
        if os.path.exists(model_path):
            self.model.load_model(model_path)
            self.loaded = True
            
            # Load metadata
            metadata_path = model_path.replace(".json", "_metadata.json")
            if os.path.exists(metadata_path):
                with open(metadata_path, 'r') as f:
                    self.metadata = json.load(f)
        else:
            self.loaded = False
            
        self.features_order = [
            'era5_rainfall_mm',
            'elevation_min', 'elevation_max', 'elevation_mean', 'elevation_std',
            'elevation_p10', 'elevation_p50', 'elevation_p90',
            'area_sqkm', 'centroid_lat', 'centroid_lon',
            'day_of_year', 'month'
        ]

    def _validate_rainfall(self, rainfall: float):
        """Strict validation for weather inputs."""
        if rainfall is None or pd.isna(rainfall):
            raise ValueError("ERA5 rainfall input cannot be missing (NaN).")
        if not np.isfinite(rainfall):
            raise ValueError("ERA5 rainfall input cannot be infinite.")
        if rainfall < 0:
            raise ValueError("ERA5 rainfall input cannot be negative.")
            
    def _parse_date(self, date_str: str):
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return dt.timetuple().tm_yday, dt.month

    def predict(self, gpcode: str, date_str: str, era5_rainfall: float, panchayat_features: dict) -> tuple[float, float, str]:
        """
        Perform live inference on a single Panchayat for a given date and ERA5 input.
        Returns: (final_prediction, residual, model_version)
        
        Prediction Formula:
        residual_prediction = XGBoost(features)
        raw_prediction = era5_rainfall_mm + residual_prediction
        final_prediction = max(0, raw_prediction)
        """
        if not self.loaded:
            raise RuntimeError("Model is not loaded.")
            
        self._validate_rainfall(era5_rainfall)
        day_of_year, month = self._parse_date(date_str)
        
        # Construct feature vector
        vector = {
            'era5_rainfall_mm': float(era5_rainfall),
            'elevation_min': float(panchayat_features.get('elevation_min', 0)),
            'elevation_max': float(panchayat_features.get('elevation_max', 0)),
            'elevation_mean': float(panchayat_features.get('elevation_mean', 0)),
            'elevation_std': float(panchayat_features.get('elevation_std', 0)),
            'elevation_p10': float(panchayat_features.get('elevation_p10', 0)),
            'elevation_p50': float(panchayat_features.get('elevation_p50', 0)),
            'elevation_p90': float(panchayat_features.get('elevation_p90', 0)),
            'area_sqkm': float(panchayat_features.get('area_sqkm', 0)),
            'centroid_lat': float(panchayat_features.get('centroid_lat', 0)),
            'centroid_lon': float(panchayat_features.get('centroid_lon', 0)),
            'day_of_year': float(day_of_year),
            'month': float(month)
        }
        
        df = pd.DataFrame([vector])[self.features_order]
        residual = float(self.model.predict(df)[0])
        downscaled = float(era5_rainfall) + residual
        
        # Bound at 0 (No negative rainfall)
        return max(0.0, downscaled), residual, self.metadata.get("model_version", "unknown")

    def batch_predict(self, inputs_list: list[dict], features_dict: dict) -> list[dict]:
        """
        Perform high-throughput batch inference.
        inputs_list format: [{"gpcode": "123", "date": "2023-01-01", "era5_rainfall_mm": 5.5}]
        """
        if not self.loaded:
            raise RuntimeError("Model is not loaded.")
            
        vectors = []
        valid_indices = []
        results = []
        
        for i, item in enumerate(inputs_list):
            try:
                gpcode = str(item['gpcode'])
                if gpcode not in features_dict:
                    raise ValueError(f"GPCODE {gpcode} not found.")
                    
                rain = float(item['era5_rainfall_mm'])
                self._validate_rainfall(rain)
                day_of_year, month = self._parse_date(item['date'])
                
                feat = features_dict[gpcode]
                vectors.append({
                    'era5_rainfall_mm': rain,
                    'elevation_min': float(feat.get('elevation_min', 0)),
                    'elevation_max': float(feat.get('elevation_max', 0)),
                    'elevation_mean': float(feat.get('elevation_mean', 0)),
                    'elevation_std': float(feat.get('elevation_std', 0)),
                    'elevation_p10': float(feat.get('elevation_p10', 0)),
                    'elevation_p50': float(feat.get('elevation_p50', 0)),
                    'elevation_p90': float(feat.get('elevation_p90', 0)),
                    'area_sqkm': float(feat.get('area_sqkm', 0)),
                    'centroid_lat': float(feat.get('centroid_lat', 0)),
                    'centroid_lon': float(feat.get('centroid_lon', 0)),
                    'day_of_year': float(day_of_year),
                    'month': float(month)
                })
                valid_indices.append(i)
                # Placeholder for successful execution
                results.append(None) 
            except Exception as e:
                # Store the error
                results.append({
                    "gpcode": item.get('gpcode'),
                    "date": item.get('date'),
                    "error": str(e)
                })
                
        if not vectors:
            return results
            
        df = pd.DataFrame(vectors)[self.features_order]
        residuals = self.model.predict(df)
        
        # Merge back
        model_version = self.metadata.get("model_version", "unknown")
        for v_idx, r_val, row in zip(valid_indices, residuals, vectors):
            rain_in = row['era5_rainfall_mm']
            downscaled = max(0.0, float(rain_in) + float(r_val))
            
            orig_item = inputs_list[v_idx]
            results[v_idx] = {
                "gpcode": orig_item["gpcode"],
                "date": orig_item["date"],
                "era5_baseline_input_mm": float(rain_in),
                "model_residual_correction_mm": float(r_val),
                "final_downscaled_prediction_mm": downscaled,
                "model_version": model_version,
                "prediction_type": "historical_experimental_inference"
            }
            
        return results

