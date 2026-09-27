import os
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import geopandas as gpd
import pandas as pd

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

# In-memory cache for fast responses
db = {
    "geojson": None,
    "features_df": None,
    "features_dict": {}
}

@app.on_event("startup")
def load_data():
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

