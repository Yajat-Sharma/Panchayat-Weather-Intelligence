"""
Crop-aware agro-met advisory engine.

Rules look across several forecast days and return reason *codes* with
parameters (e.g. ``{"code": "irrigation.skip", "params": {"mm": 22, "days": 3}}``)
rather than prose, so the UI can render them in EN / HI / MR and the AI
copilot sees exactly the same decision.
"""
from typing import Dict, List, Optional

RAIN_EVENT_MM = 2.5
HEAVY_RAIN_MM = 30.0
SPRAY_WIND_KMH = 15.0
RAIN_PROB_SKIP = 0.6
FUNGAL_RH = 85.0
FUNGAL_T_RANGE = (20.0, 30.0)
FUNGAL_MIN_DAYS = 2

# 3-day rain (mm) that covers the crop's water need, and temperature (°C) above
# which heat stress sets in. Indicative values for Pune-region kharif/rabi practice.
CROP_PARAMS: Dict[str, dict] = {
    "rice": {"rain_need_3d_mm": 25.0, "heat_critical_c": 35.0},
    "soybean": {"rain_need_3d_mm": 15.0, "heat_critical_c": 35.0},
    "maize": {"rain_need_3d_mm": 15.0, "heat_critical_c": 35.0},
    "vegetables": {"rain_need_3d_mm": 10.0, "heat_critical_c": 32.0},
    "sugarcane": {"rain_need_3d_mm": 20.0, "heat_critical_c": 38.0},
    "generic": {"rain_need_3d_mm": 15.0, "heat_critical_c": 35.0},
}


def _v(day: dict, var: str, key: str = "value") -> Optional[float]:
    entry = day.get(var) or {}
    val = entry.get(key)
    if val is None and key == "p50":
        val = entry.get("value")
    return None if val is None else float(val)


def rain_probability(day: dict) -> tuple[Optional[float], str]:
    """Classifier probability when available, otherwise a coarse proxy from the quantile band."""
    p = _v(day, "rainfall", "prob")
    if p is not None:
        return p, "classifier"
    p10, p50, p90 = (_v(day, "rainfall", q) for q in ("p10", "p50", "p90"))
    if p50 is None:
        return None, "none"
    if p10 is not None and p90 is not None:
        if p10 > RAIN_EVENT_MM:
            return 0.9, "quantile_proxy"
        if p50 > RAIN_EVENT_MM:
            return 0.6, "quantile_proxy"
        if p90 > RAIN_EVENT_MM:
            return 0.3, "quantile_proxy"
        return 0.1, "quantile_proxy"
    return (1.0 if p50 > RAIN_EVENT_MM else 0.0), "deterministic"


def _r(x: Optional[float], nd=1):
    return None if x is None else round(x, nd)


def irrigation(days: List[dict], crop: dict) -> dict:
    window = days[:3]
    rain3 = sum(_v(d, "rainfall", "p50") or 0.0 for d in window)
    need = crop["rain_need_3d_mm"]
    prob, basis = rain_probability(days[0])
    params = {"mm": _r(rain3), "days": len(window), "need": need}
    if basis in ("classifier", "quantile_proxy") and prob is not None and prob >= RAIN_PROB_SKIP:
        return {"status": "skip", "tone": "good", "code": "irrigation.skipLikelyRain",
                "params": {**params, "prob": round(prob * 100)}, "basis": basis}
    if rain3 >= need:
        return {"status": "skip", "tone": "good", "code": "irrigation.skip", "params": params}
    if rain3 >= need / 2:
        return {"status": "reduce", "tone": "neutral", "code": "irrigation.reduce", "params": params}
    return {"status": "irrigate", "tone": "caution", "code": "irrigation.needed", "params": params}


def spraying(days: List[dict], crop: dict) -> dict:
    d0 = days[0]
    wind = _v(d0, "wind")
    rain = _v(d0, "rainfall", "p50") or 0.0
    prob, _ = rain_probability(d0)
    if wind is not None and wind > SPRAY_WIND_KMH:
        return {"status": "avoid", "tone": "caution", "code": "spray.avoidWind",
                "params": {"kmh": _r(wind), "limit": SPRAY_WIND_KMH}}
    if rain > RAIN_EVENT_MM or (prob is not None and prob >= 0.5):
        return {"status": "avoid", "tone": "caution", "code": "spray.avoidRain",
                "params": {"mm": _r(rain), "prob": None if prob is None else round(prob * 100)}}
    return {"status": "ok", "tone": "good", "code": "spray.ok",
            "params": {"kmh": _r(wind), "mm": _r(rain)}}


def heat_stress(days: List[dict], crop: dict) -> dict:
    crit = crop["heat_critical_c"]
    tmaxes = [(i, _v(d, "tmax")) for i, d in enumerate(days[:3])]
    tmaxes = [(i, t) for i, t in tmaxes if t is not None]
    if not tmaxes:
        return {"status": "unknown", "tone": "neutral", "code": "heat.unknown", "params": {}}
    i, peak = max(tmaxes, key=lambda x: x[1])
    params = {"t": _r(peak), "crit": crit, "dayOffset": i}
    if peak >= crit:
        return {"status": "high", "tone": "caution", "code": "heat.stress", "params": params}
    if peak >= crit - 2:
        return {"status": "watch", "tone": "neutral", "code": "heat.watch", "params": params}
    return {"status": "low", "tone": "good", "code": "heat.ok", "params": params}


def fungal_risk(days: List[dict], crop: dict) -> dict:
    lo, hi = FUNGAL_T_RANGE
    streak = best = 0
    have_data = False
    for d in days:
        rh, tx, tn = _v(d, "rh"), _v(d, "tmax"), _v(d, "tmin")
        if rh is None or tx is None or tn is None:
            streak = 0
            continue
        have_data = True
        tmean = (tx + tn) / 2
        if rh >= FUNGAL_RH and lo <= tmean <= hi:
            streak += 1
            best = max(best, streak)
        else:
            streak = 0
    if not have_data:
        return {"status": "unknown", "tone": "neutral", "code": "pest.unknown", "params": {}}
    params = {"days": best, "rh": FUNGAL_RH, "tLo": lo, "tHi": hi}
    if best >= FUNGAL_MIN_DAYS:
        return {"status": "high", "tone": "caution", "code": "pest.high", "params": params}
    if best == 1:
        return {"status": "watch", "tone": "neutral", "code": "pest.watch", "params": params}
    return {"status": "low", "tone": "good", "code": "pest.low", "params": params}


def field_work(days: List[dict], crop: dict) -> dict:
    rains = [(i, _v(d, "rainfall", "p50") or 0.0) for i, d in enumerate(days[:3])]
    i, peak = max(rains, key=lambda x: x[1]) if rains else (0, 0.0)
    params = {"mm": _r(peak), "dayOffset": i, "limit": HEAVY_RAIN_MM}
    if peak > HEAVY_RAIN_MM:
        return {"status": "delay", "tone": "caution", "code": "field.delay", "params": params}
    return {"status": "ok", "tone": "good", "code": "field.ok", "params": params}


RULES = [
    ("irrigation", irrigation),
    ("spraying", spraying),
    ("heat", heat_stress),
    ("pest", fungal_risk),
    ("field", field_work),
]


def build_advisory(days: List[dict], crop: Optional[str] = None, start: int = 0) -> dict:
    """Evaluate every rule on the forecast window starting at day `start`."""
    window = [d for d in days[start:] if "error" not in d]
    crop_key = (crop or "generic").strip().lower() or "generic"
    params = CROP_PARAMS.get(crop_key, CROP_PARAMS["generic"])
    if not window:
        return {"crop": crop_key, "items": [], "status": "NO_FORECAST"}
    items = [{"id": rid, **fn(window, params)} for rid, fn in RULES]
    return {
        "crop": crop_key,
        "crop_known": crop_key in CROP_PARAMS,
        "date": window[0].get("date"),
        "window_days": len(window),
        "items": items,
    }
