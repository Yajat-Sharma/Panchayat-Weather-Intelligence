import requests
import json
from typing import Dict, Any, List

class ContextService:
    @staticmethod
    def get_panchayat_context(gpcode: str, db: Dict[str, Any]) -> Dict[str, Any]:
        """
        Retrieves Panchayat metadata and recent/forecast weather.
        """
        if gpcode not in db["features_dict"]:
            return {"error": "Panchayat not found."}
            
        feat = db["features_dict"][gpcode]
        
        # Build basic context
        context = {
            "gpcode": gpcode,
            "panchayat_name": feat.get("GPNAME", "Unknown"),
            "block_name": feat.get("blkname", "Unknown"),
            "district_name": feat.get("dtname", "Unknown"),
            "state_name": feat.get("stname", "Unknown"),
            "elevation_mean_meters": feat.get("elevation_mean", 0.0),
            "area_sqkm": feat.get("area_sqkm", 0.0),
        }
        
        # Attempt to get operational forecast
        downscaler = db.get("downscaler")
        forecast_data = []
        
        if downscaler and downscaler.loaded:
            lat = feat.get("centroid_lat")
            lon = feat.get("centroid_lon")
            if lat is not None and lon is not None:
                try:
                    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&daily=precipitation_sum&models=ecmwf_ifs025&timezone=Asia/Kolkata"
                    resp = requests.get(url, timeout=5)
                    if resp.status_code == 200:
                        weather_data = resp.json()
                        daily = weather_data.get("daily", {})
                        dates = daily.get("time", [])
                        rains = daily.get("precipitation_sum", [])
                        
                        batch_payload = []
                        for d, r in zip(dates, rains):
                            val = 0.0 if r is None else float(r)
                            batch_payload.append({
                                "gpcode": gpcode,
                                "date": d,
                                "era5_rainfall_mm": val
                            })
                            
                        results = downscaler.batch_predict(batch_payload, db["features_dict"])
                        # Format nicely for LLM
                        for res in results:
                            forecast_data.append({
                                "date": res["date"],
                                "ecmwf_base_rainfall_mm": res["era5_baseline_input_mm"],
                                "xgboost_downscaled_rainfall_mm": round(res["final_downscaled_prediction_mm"], 2)
                            })
                except Exception as e:
                    print(f"Failed to fetch forecast for context: {e}")
        
        if forecast_data:
            context["7_day_operational_forecast"] = forecast_data
        else:
            context["weather_status"] = "Operational forecast currently unavailable."
            
        return context
