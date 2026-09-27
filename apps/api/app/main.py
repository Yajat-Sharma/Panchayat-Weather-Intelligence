import os
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import geopandas as gpd
import pandas as pd
from .inference import WeatherDownscaler

app = FastAPI(
    title="SIH Weather Downscaling API",
    description="API for Panchayat-level Weather Forecast Downscaling",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for local development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
GEOJSON_PATH = os.path.join(BASE_DIR, "data", "interim", "boundaries", "pune_panchayats_valid.geojson")
PARQUET_PATH = os.path.join(BASE_DIR, "data", "processed", "features", "panchayat_static_features.parquet")
MODEL_PATH = os.path.join(BASE_DIR, "data", "models", "xgboost_downscaler.json")

# In-memory cache for fast responses
db = {
    "geojson": None,
    "features_df": None,
    "features_dict": {},
    "downscaler": None
}

@app.on_event("startup")
def load_data():
    db["downscaler"] = WeatherDownscaler(MODEL_PATH)
    
    if os.path.exists(PARQUET_PATH):
        df = pd.read_parquet(PARQUET_PATH)
        db["features_df"] = df
        # Index by GPCODE
        for _, row in df.iterrows():
            gpcode_val = row.get("GPCODE")
            if pd.notna(gpcode_val) and str(gpcode_val).strip() != "":
                try:
                    db["features_dict"][str(int(float(gpcode_val)))] = row.to_dict()
                except ValueError:
                    pass # Skip invalid gpcodes
    
    if os.path.exists(GEOJSON_PATH):
        # Load raw json to avoid geopandas serialization overhead on every request
        with open(GEOJSON_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            # Augment features
            for feature in data.get("features", []):
                props = feature.get("properties", {})
                gpcode = props.get("GPCODE")
                if gpcode is not None and str(gpcode).strip() != "":
                    try:
                        gpcode_str = str(int(float(gpcode)))
                        if gpcode_str in db["features_dict"]:
                            feat = db["features_dict"][gpcode_str]
                            # Just attach basic name and area
                            props["GPNAME"] = feat.get("GPNAME", "")
                            props["area_sqkm"] = feat.get("area_sqkm", 0.0)
                    except ValueError:
                        pass
                        
            db["geojson"] = data

@app.get("/")
def read_root():
    return {"message": "Welcome to the SIH Weather Downscaling API"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/api/v1/status")
def get_status():
    return {
        "panchayat_dataset": "Available" if db["geojson"] else "Not Available",
        "dem": "Available" if db["features_df"] is not None else "Not Available",
        "era5": "Available and Extracted",
        "preprocessing_status": "Complete",
        "ml_model": "TRAINED (XGBoost Residual Downscaling)",
        "fine_resolution_target": "CHIRPS v2.0 (0.05°)"
    }

@app.get("/api/v1/panchayats")
def get_panchayats():
    if not db["geojson"]:
        raise HTTPException(status_code=404, detail="Panchayat boundaries not found.")
    return db["geojson"]

@app.get("/api/v1/panchayats/{gpcode}")
def get_panchayat_details(gpcode: str):
    if gpcode not in db["features_dict"]:
        raise HTTPException(status_code=404, detail="Panchayat features not found.")
    
    feat = db["features_dict"][gpcode]
    # Convert numpy types to python native types
    return {k: (float(v) if pd.api.types.is_number(v) and pd.notna(v) else v) for k, v in feat.items()}

@app.get("/api/v1/panchayats/{gpcode}/weather")
def get_panchayat_weather(gpcode: str):
    predictions_path = os.path.join(BASE_DIR, "data", "processed", "predictions", "test_predictions.parquet")
    if not os.path.exists(predictions_path):
        return {
            "status": "BLOCKED",
            "message": "Historical weather extraction and ML downscaling are not completed yet."
        }
        
    try:
        # For a production app, we would cache this or use a database.
        # But this is a static historical demo.
        df = pd.read_parquet(predictions_path, filters=[("GPCODE", "==", gpcode)])
        if df.empty:
            raise HTTPException(status_code=404, detail="No weather predictions found for this Panchayat (may be in training set).")
            
        timeseries = df.to_dict(orient="records")
        return {
            "status": "AVAILABLE",
            "gpcode": gpcode,
            "timeseries": timeseries
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/panchayats/{gpcode}/weather/live")
def get_live_downscaling(gpcode: str, date: str, era5_rainfall_mm: float):
    """
    Live on-the-fly execution of the XGBoost Downscaling Inference Pipeline.
    Pass an arbitrary date (YYYY-MM-DD) and ERA5 coarse forecast value.
    """
    if gpcode not in db["features_dict"]:
        raise HTTPException(status_code=404, detail="Panchayat features not found.")
        
    downscaler = db.get("downscaler")
    if not downscaler or not downscaler.loaded:
        raise HTTPException(status_code=503, detail="Downscaling inference model is not loaded or unavailable.")
        
    feat = db["features_dict"][gpcode]
    
    try:
        final_prediction, residual, model_version = downscaler.predict(
            gpcode=gpcode,
            date_str=date,
            era5_rainfall=era5_rainfall_mm,
            panchayat_features=feat
        )
        return {
            "gpcode": gpcode,
            "date": date,
            "era5_baseline_input_mm": era5_rainfall_mm,
            "model_residual_correction_mm": residual,
            "final_downscaled_prediction_mm": final_prediction,
            "model_version": model_version,
            "prediction_type": "historical_experimental_inference"
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=f"Invalid input data: {str(ve)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference pipeline failed: {str(e)}")

from pydantic import BaseModel
from typing import List

class BatchInferenceRequest(BaseModel):
    gpcode: str
    date: str
    era5_rainfall_mm: float

@app.post("/api/v1/panchayats/weather/batch")
def post_batch_downscaling(requests: List[BatchInferenceRequest]):
    """
    High-throughput reproducible batch inference.
    Send a list of JSON objects containing gpcode, date, and era5_rainfall_mm.
    """
    downscaler = db.get("downscaler")
    if not downscaler or not downscaler.loaded:
        raise HTTPException(status_code=503, detail="Downscaling inference model is not loaded or unavailable.")
        
    if not requests:
        raise HTTPException(status_code=400, detail="Empty request list.")
        
    inputs = [req.dict() for req in requests]
    
    try:
        results = downscaler.batch_predict(inputs, db["features_dict"])
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch inference failed: {str(e)}")

import requests

@app.get("/api/v1/panchayats/{gpcode}/weather/forecast")
def get_operational_forecast(gpcode: str):
    """
    Live Operational 7-Day Forecast using ECMWF IFS 0.25 via Open-Meteo.
    """
    if gpcode not in db["features_dict"]:
        raise HTTPException(status_code=404, detail="Panchayat features not found.")
        
    downscaler = db.get("downscaler")
    if not downscaler or not downscaler.loaded:
        raise HTTPException(status_code=503, detail="Downscaling inference model is not loaded or unavailable.")
        
    feat = db["features_dict"][gpcode]
    lat = feat.get("centroid_lat")
    lon = feat.get("centroid_lon")
    
    if lat is None or lon is None:
        raise HTTPException(status_code=400, detail="Panchayat is missing centroid coordinates.")
        
    # Fetch operational ECMWF forecast
    try:
        url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&daily=precipitation_sum&models=ecmwf_ifs025&timezone=Asia/Kolkata"
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        weather_data = resp.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch operational forecast: {str(e)}")
        
    daily = weather_data.get("daily", {})
    dates = daily.get("time", [])
    rains = daily.get("precipitation_sum", [])
    
    if not dates or not rains or len(dates) != len(rains):
        raise HTTPException(status_code=502, detail="Invalid operational forecast data received.")
        
    # Construct batch payload
    batch_payload = []
    for d, r in zip(dates, rains):
        # Open-Meteo might return None for precipitation if no data
        val = 0.0 if r is None else float(r)
        batch_payload.append({
            "gpcode": gpcode,
            "date": d,
            "era5_rainfall_mm": val
        })
        
    # Run through XGBoost
    try:
        results = downscaler.batch_predict(batch_payload, db["features_dict"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch inference failed: {str(e)}")
        
    # Override prediction_type to reflect the operational nature
    for res in results:
        res["prediction_type"] = "live_operational_forecast"
        res["operational_source"] = "ECMWF IFS 0.25 (via Open-Meteo)"
        
    return {
        "gpcode": gpcode,
        "status": "AVAILABLE",
        "forecast": results
    }


