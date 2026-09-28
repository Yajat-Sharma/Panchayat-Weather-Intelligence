from typing import Any, Dict, Optional

from .advisory_service import build_advisory
from .downscale_service import VALIDATION_SCOPE, forecast_days


def _compact(day: dict) -> dict:
    """Trim a forecast day to what the LLM needs."""
    out = {"date": day["date"]}
    for var, v in day.items():
        if isinstance(v, dict) and "value" in v:
            out[var] = {k: v.get(k) for k in ("coarse", "value", "p10", "p90", "prob", "unit") if v.get(k) is not None}
    return out


class ContextService:
    @staticmethod
    def get_panchayat_context(gpcode: str, db: Dict[str, Any], crop: Optional[str] = None) -> Dict[str, Any]:
        """Panchayat metadata, downscaled forecast and the rule-based advisory (same one the UI shows)."""
        if gpcode not in db["features_dict"]:
            return {"error": "Panchayat not found."}

        feat = db["features_dict"][gpcode]
        context = {
            "gpcode": gpcode,
            "panchayat_name": feat.get("GPNAME", "Unknown"),
            "block_name": feat.get("blkname", "Unknown"),
            "district_name": feat.get("dtname", "Unknown"),
            "state_name": feat.get("stname", "Unknown"),
            "elevation_mean_meters": feat.get("elevation_mean", 0.0),
            "area_sqkm": feat.get("area_sqkm", 0.0),
        }

        registry = db.get("registry")
        days = []
        if registry is not None and registry.loaded:
            try:
                coarse = db["forecast"].for_panchayat(feat)
                days = forecast_days(registry, gpcode, feat, coarse)
            except Exception as e:
                print(f"Failed to fetch forecast for context: {e}")

        if days:
            context["7_day_operational_forecast"] = [_compact(d) for d in days]
            context["forecast_notes"] = (
                "coarse = ECMWF IFS 0.25° grid-cell value; value = Panchayat-level downscaled value; "
                "p10/p90 = 80% uncertainty range; prob = probability of rain > 2.5 mm."
            )
            context["advisory"] = build_advisory(days, crop)
        else:
            context["weather_status"] = "Operational forecast currently unavailable."

        if registry is not None and registry.metrics:
            context["model_validation"] = {"scope": VALIDATION_SCOPE, "metrics": registry.metrics}
        return context
