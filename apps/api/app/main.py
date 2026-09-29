import json
import os
from typing import List, Optional

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .inference import VARIABLE_SPECS, ModelRegistry, WeatherDownscaler
from .services.advisory_service import build_advisory
from .services.assistant_service import AssistantService
from .services.downscale_service import (
    VALIDATION_SCOPE,
    area_weighted_mean,
    block_members,
    canonical_block_name,
    downscale,
    downscale_block,
    forecast_days,
    list_blocks,
)
from .services.forecast_service import SOURCE_LABEL, forecast_service

app = FastAPI(
    title="SIH Weather Downscaling API",
    description="API for Panchayat-level Weather Forecast Downscaling",
    version="0.2.0",
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
MODELS_DIR = os.environ.get("PWI_MODELS_DIR", os.path.join(BASE_DIR, "data", "models"))
MODEL_PATH = os.path.join(MODELS_DIR, "xgboost_downscaler.json")

# In-memory cache for fast responses
db = {
    "geojson": None,
    "features_df": None,
    "features_dict": {},
    "registry": None,
    "downscaler": None,
    "forecast": forecast_service,
}


def _gp_key(val) -> Optional[str]:
    if val is None or pd.isna(val) or str(val).strip() == "":
        return None
    try:
        return str(int(float(val)))
    except ValueError:
        return None


@app.on_event("startup")
def load_data():
    db["registry"] = ModelRegistry(MODELS_DIR)
    db["downscaler"] = WeatherDownscaler(MODEL_PATH, registry=db["registry"])

    if os.path.exists(PARQUET_PATH):
        df = pd.read_parquet(PARQUET_PATH)
        db["features_df"] = df
        for _, row in df.iterrows():
            gp = _gp_key(row.get("GPCODE"))
            if gp:
                db["features_dict"][gp] = row.to_dict()
        forecast_service.prime(db["features_dict"])

    if os.path.exists(GEOJSON_PATH):
        # Load raw json to avoid geopandas serialization overhead on every request
        with open(GEOJSON_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        for feature in data.get("features", []):
            props = feature.get("properties", {})
            gp = _gp_key(props.get("GPCODE"))
            if gp and gp in db["features_dict"]:
                feat = db["features_dict"][gp]
                props["GPNAME"] = feat.get("GPNAME", "")
                props["area_sqkm"] = feat.get("area_sqkm", 0.0)
        db["geojson"] = data


def _registry() -> ModelRegistry:
    reg = db.get("registry")
    if reg is None or not reg.loaded:
        raise HTTPException(status_code=503, detail="Downscaling inference model is not loaded or unavailable.")
    return reg


def _feat(gpcode: str) -> dict:
    if gpcode not in db["features_dict"]:
        raise HTTPException(status_code=404, detail="Panchayat features not found.")
    return db["features_dict"][gpcode]


@app.get("/")
def read_root():
    return {"message": "Welcome to the SIH Weather Downscaling API"}


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/api/v1/status")
def get_status():
    reg = db.get("registry")
    variables = sorted(reg.models) if reg else []
    return {
        "panchayat_dataset": "Available" if db["geojson"] else "Not Available",
        "dem": "Available" if db["features_df"] is not None else "Not Available",
        "era5": "Available and Extracted",
        "preprocessing_status": "Complete",
        "ml_model": f"TRAINED (XGBoost residual: {', '.join(variables)})" if variables else "NOT LOADED",
        "fine_resolution_target": "CHIRPS v2.0 (0.05°) rainfall; ERA5-Land (0.1°) temperature/humidity/wind",
    }


@app.get("/api/v1/metrics")
def get_metrics():
    """Spatial-block cross-validation results per variable (from data/models/metrics.json)."""
    reg = db.get("registry")
    metrics = reg.metrics if reg else {}
    return {
        "validation_scope": VALIDATION_SCOPE,
        "variables_loaded": sorted(reg.models) if reg else [],
        "metrics": metrics,
    }


@app.get("/api/v1/panchayats")
def get_panchayats():
    if not db["geojson"]:
        raise HTTPException(status_code=404, detail="Panchayat boundaries not found.")
    return db["geojson"]


@app.get("/api/v1/panchayats/{gpcode}")
def get_panchayat_details(gpcode: str):
    feat = _feat(gpcode)
    # Convert numpy types to python native types
    return {k: (float(v) if pd.api.types.is_number(v) and pd.notna(v) else v) for k, v in feat.items()}


@app.get("/api/v1/panchayats/{gpcode}/weather")
def get_panchayat_weather(gpcode: str):
    # Spatial-block out-of-fold predictions cover every Panchayat; fall back to the older random-split file.
    pred_dir = os.path.join(BASE_DIR, "data", "processed", "predictions")
    candidates = [os.path.join(pred_dir, n) for n in ("spatial_block_oof_predictions.parquet", "test_predictions.parquet")]
    predictions_path = next((p for p in candidates if os.path.exists(p)), None)
    if predictions_path is None:
        return {
            "status": "BLOCKED",
            "message": "Historical weather extraction and ML downscaling are not completed yet.",
        }
    try:
        df = pd.read_parquet(predictions_path, filters=[("GPCODE", "==", gpcode)])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    if df.empty:
        raise HTTPException(status_code=404, detail="No historical predictions found for this Panchayat.")
    df["date"] = df["date"].astype(str).str[:10]
    return {"status": "AVAILABLE", "gpcode": gpcode, "timeseries": df.to_dict(orient="records")}


@app.get("/api/v1/panchayats/{gpcode}/weather/live")
def get_live_downscaling(gpcode: str, date: str, era5_rainfall_mm: float):
    """
    Live on-the-fly execution of the XGBoost Downscaling Inference Pipeline.
    Pass an arbitrary date (YYYY-MM-DD) and ERA5 coarse forecast value.
    """
    feat = _feat(gpcode)
    downscaler = db.get("downscaler")
    if not downscaler or not downscaler.loaded:
        raise HTTPException(status_code=503, detail="Downscaling inference model is not loaded or unavailable.")
    try:
        final_prediction, residual, model_version = downscaler.predict(
            gpcode=gpcode, date_str=date, era5_rainfall=era5_rainfall_mm, panchayat_features=feat
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=f"Invalid input data: {str(ve)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference pipeline failed: {str(e)}")
    return {
        "gpcode": gpcode,
        "date": date,
        "era5_baseline_input_mm": era5_rainfall_mm,
        "model_residual_correction_mm": residual,
        "final_downscaled_prediction_mm": final_prediction,
        "model_version": model_version,
        "prediction_type": "historical_experimental_inference",
    }


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
    try:
        return {"results": downscaler.batch_predict([r.model_dump() for r in requests], db["features_dict"])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch inference failed: {str(e)}")


def panchayat_forecast(gpcode: str) -> List[dict]:
    """Downscaled 7-day forecast (all variables) for one Panchayat. Raises HTTPException on failure."""
    feat = _feat(gpcode)
    reg = _registry()
    try:
        coarse = db["forecast"].for_panchayat(feat)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch operational forecast: {str(e)}")
    try:
        return forecast_days(reg, gpcode, feat, coarse)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch inference failed: {str(e)}")


@app.get("/api/v1/panchayats/{gpcode}/weather/forecast")
def get_operational_forecast(gpcode: str):
    """Live 7-day forecast: ECMWF IFS 0.25° grid-cell values downscaled per Panchayat, per variable."""
    days = panchayat_forecast(gpcode)
    return {
        "gpcode": gpcode,
        "status": "AVAILABLE",
        "source": SOURCE_LABEL,
        "validation_scope": VALIDATION_SCOPE,
        "variables": list(VARIABLE_SPECS),
        "forecast": days,
    }


@app.get("/api/v1/panchayats/{gpcode}/advisory")
def get_advisory(gpcode: str, crop: Optional[str] = None, day: int = Query(0, ge=0, le=6)):
    """Crop-aware advisory built from the downscaled multi-day forecast. Returns reason codes, not prose."""
    days = panchayat_forecast(gpcode)
    return {"gpcode": gpcode, "validation_scope": VALIDATION_SCOPE, **build_advisory(days, crop, start=day)}


@app.get("/api/v1/map/forecast")
def get_map_forecast(
    date: Optional[str] = None,
    var: str = Query("rainfall"),
):
    """Coarse and downscaled value of one variable for every Panchayat on one date (map layer)."""
    if var not in VARIABLE_SPECS:
        raise HTTPException(status_code=400, detail=f"Unknown variable '{var}'.")
    reg = _registry()
    feats = db["features_dict"]
    if not feats:
        raise HTTPException(status_code=404, detail="Panchayat features not found.")
    try:
        coarse = db["forecast"].for_panchayats(feats)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch operational forecast: {str(e)}")

    any_fc = next(iter(coarse.values()))
    dates = [d["date"] for d in any_fc["days"]]
    date = date or dates[0]
    if date not in dates:
        raise HTTPException(status_code=400, detail=f"Date must be one of {dates}.")
    di = dates.index(date)

    gps = list(coarse)
    rows = [{"feat": feats[gp], "date": date, "coarse": {var: coarse[gp]["days"][di].get(var)},
             "cell_elevation_m": coarse[gp].get("cell_elevation_m")} for gp in gps]
    out = downscale(reg, rows)
    values = {}
    for gp, vals in zip(gps, out):
        v = vals.get(var)
        if v:
            values[gp] = {k: v.get(k) for k in ("coarse", "value", "p10", "p90")}
    return {
        "date": date,
        "dates": dates,
        "variable": var,
        "unit": VARIABLE_SPECS[var]["unit"],
        "downscaled": var in reg.models,
        "validation_scope": VALIDATION_SCOPE,
        "values": values,
    }


# ---- Block -> Panchayat ----------------------------------------------------

def _members(block: str) -> dict:
    members = block_members(db["features_dict"], block)
    if not members:
        raise HTTPException(status_code=404, detail=f"Block '{block}' not found.")
    return members


@app.get("/api/v1/blocks")
def get_blocks():
    return {"blocks": list_blocks(db["features_dict"])}


@app.get("/api/v1/blocks/{block}/forecast")
def get_block_forecast(block: str):
    """
    Block-level coarse forecast (area-weighted mean of the grid-cell values over the
    block's Panchayats) and every Panchayat's downscaled value, with within-block spread.
    """
    reg = _registry()
    members = _members(block)
    try:
        coarse = db["forecast"].for_panchayats(members)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch operational forecast: {str(e)}")
    gps = [gp for gp in members if gp in coarse]
    weights = [float(members[gp].get("area_sqkm") or 0.0) for gp in gps]
    dates = [d["date"] for d in coarse[gps[0]]["days"]]
    block_days = []
    for di, date in enumerate(dates):
        day = {"date": date}
        for var in VARIABLE_SPECS:
            day[var] = area_weighted_mean([coarse[gp]["days"][di].get(var) for gp in gps], weights)
        block_days.append(day)
    cell_elev = area_weighted_mean([coarse[gp].get("cell_elevation_m") for gp in gps], weights)
    result = downscale_block(reg, {gp: members[gp] for gp in gps}, block_days, cell_elev)
    return {
        "block": canonical_block_name(members),
        "district": members[gps[0]].get("dtname"),
        "panchayat_count": len(gps),
        "source": SOURCE_LABEL,
        "input": "area_weighted_block_mean",
        "validation_scope": VALIDATION_SCOPE,
        **result,
    }


class BlockDay(BaseModel):
    date: str = Field(..., description="YYYY-MM-DD")
    rainfall: Optional[float] = Field(None, ge=0, description="Block rainfall, mm/day")
    tmax: Optional[float] = Field(None, ge=-20, le=60, description="Block max temperature, °C")
    tmin: Optional[float] = Field(None, ge=-20, le=60, description="Block min temperature, °C")
    rh: Optional[float] = Field(None, ge=0, le=100, description="Block mean relative humidity, %")
    wind: Optional[float] = Field(None, ge=0, le=300, description="Block mean wind speed, km/h")


class BlockDownscaleRequest(BaseModel):
    days: List[BlockDay] = Field(..., min_length=1, max_length=16)


@app.post("/api/v1/blocks/{block}/downscale")
def post_block_downscale(block: str, body: BlockDownscaleRequest):
    """
    Downscale a user-supplied block-level forecast (e.g. from an IMD block agro-met
    bulletin) to every Panchayat in the block.
    """
    reg = _registry()
    members = _members(block)
    from datetime import datetime
    for d in body.days:
        try:
            datetime.strptime(d.date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid date '{d.date}'.")
        if all(getattr(d, v) is None for v in VARIABLE_SPECS):
            raise HTTPException(status_code=400, detail=f"Day {d.date} has no values.")
    weights = [float(f.get("area_sqkm") or 0.0) for f in members.values()]
    # A bulletin value represents the block as a whole, so it sits at the block's mean elevation.
    block_elev = area_weighted_mean([f.get("elevation_mean") for f in members.values()], weights)
    result = downscale_block(reg, members, [d.model_dump() for d in body.days], block_elev)
    first = next(iter(members.values()))
    return {
        "block": canonical_block_name(members),
        "district": first.get("dtname"),
        "panchayat_count": len(members),
        "input": "user_supplied_block_forecast",
        "validation_scope": VALIDATION_SCOPE,
        **result,
    }


# ---- Copilot -----------------------------------------------------------------

class MessageHistory(BaseModel):
    role: str
    content: str


class CopilotRequest(BaseModel):
    gpcode: str
    crop: Optional[str] = None
    language: str = "en"
    message: str
    history: List[MessageHistory] = []


@app.post("/api/v1/assistant/chat")
def post_assistant_chat(request: CopilotRequest):
    """
    Panchayat AI Copilot Endpoint.
    Context-aware RAG backend for the ChatbotDrawer.
    """
    assistant = AssistantService(db)
    history_dicts = [{"role": msg.role, "content": msg.content} for msg in request.history]
    return assistant.chat(
        gpcode=request.gpcode,
        crop=request.crop,
        language=request.language,
        message=request.message,
        history=history_dicts,
    )
