"""
Shared coarse-forecast service.

Every Panchayat centroid is snapped to the centre of its ECMWF IFS 0.25° grid
cell, so the whole district needs only a few dozen unique cells. All cells are
fetched from Open-Meteo in a single multi-location request with
``elevation=nan`` (which disables Open-Meteo's own elevation correction), so
the value we feed the downscaler really is the coarse grid-cell value.
Results are cached in memory for one hour.
"""
import threading
import time
from typing import Dict, Iterable, List, Optional, Tuple

import requests

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
GRID_DEG = 0.25
CACHE_TTL_S = 3600
SOURCE_LABEL = "ECMWF IFS 0.25 (via Open-Meteo)"

# Open-Meteo daily variable -> internal variable name
DAILY_VARS = {
    "precipitation_sum": "rainfall",
    "temperature_2m_max": "tmax",
    "temperature_2m_min": "tmin",
    "relative_humidity_2m_mean": "rh",
    "wind_speed_10m_mean": "wind",
}

Cell = Tuple[float, float]


def snap_to_grid(lat: float, lon: float, step: float = GRID_DEG) -> Cell:
    """Centre of the coarse grid cell containing (lat, lon)."""
    return (round(round(lat / step) * step, 4), round(round(lon / step) * step, 4))


class ForecastService:
    def __init__(self, ttl_s: int = CACHE_TTL_S, http_get=None):
        self.ttl_s = ttl_s
        self._http_get = http_get or requests.get
        self._lock = threading.Lock()
        self._cache: Dict[Cell, dict] = {}
        self._fetched_at: float = 0.0
        self._cells: Tuple[Cell, ...] = ()

    def _fetch(self, cells: List[Cell]) -> Dict[Cell, dict]:
        params = {
            "latitude": ",".join(str(c[0]) for c in cells),
            "longitude": ",".join(str(c[1]) for c in cells),
            "elevation": ",".join("nan" for _ in cells),
            "daily": ",".join(DAILY_VARS),
            "models": "ecmwf_ifs025",
            "timezone": "Asia/Kolkata",
        }
        resp = self._http_get(OPEN_METEO_URL, params=params, timeout=15)
        resp.raise_for_status()
        payload = resp.json()
        if isinstance(payload, dict):  # single location returns an object
            payload = [payload]
        if len(payload) != len(cells):
            raise ValueError("Open-Meteo returned a different number of locations than requested.")

        out: Dict[Cell, dict] = {}
        for cell, loc in zip(cells, payload):
            daily = loc.get("daily", {})
            dates = daily.get("time", [])
            if not dates:
                raise ValueError("Open-Meteo returned no daily data.")
            days = []
            for i, d in enumerate(dates):
                day = {"date": d}
                for om_key, name in DAILY_VARS.items():
                    vals = daily.get(om_key) or []
                    v = vals[i] if i < len(vals) else None
                    day[name] = None if v is None else float(v)
                days.append(day)
            out[cell] = {"cell_elevation_m": loc.get("elevation"), "days": days}
        return out

    def get_cells(self, cells: Iterable[Cell]) -> Dict[Cell, dict]:
        """Coarse daily forecast for each requested grid cell (cached, one request per refresh)."""
        wanted = tuple(sorted(set(cells)))
        with self._lock:
            fresh = time.time() - self._fetched_at < self.ttl_s
            if not (fresh and all(c in self._cache for c in wanted)):
                # Refresh everything we've seen so one request keeps covering the whole district.
                all_cells = sorted(set(self._cells) | set(wanted))
                self._cache = self._fetch(all_cells)
                self._cells = tuple(all_cells)
                self._fetched_at = time.time()
            return {c: self._cache[c] for c in wanted}

    def prime(self, features_dict: dict) -> None:
        """Register every Panchayat's cell so the first fetch covers the whole district."""
        cells = {self.cell_for(f) for f in features_dict.values()}
        cells.discard(None)
        with self._lock:
            self._cells = tuple(sorted(set(self._cells) | cells))

    @staticmethod
    def cell_for(feat: dict) -> Optional[Cell]:
        lat, lon = feat.get("centroid_lat"), feat.get("centroid_lon")
        if lat is None or lon is None:
            return None
        return snap_to_grid(float(lat), float(lon))

    def for_panchayat(self, feat: dict) -> dict:
        cell = self.cell_for(feat)
        if cell is None:
            raise ValueError("Panchayat is missing centroid coordinates.")
        data = self.get_cells([cell])[cell]
        return {"cell": {"lat": cell[0], "lon": cell[1]}, **data}

    def for_panchayats(self, features: Dict[str, dict]) -> Dict[str, dict]:
        """gpcode -> coarse forecast for many Panchayats (still one upstream request)."""
        cells = {gp: self.cell_for(f) for gp, f in features.items()}
        data = self.get_cells([c for c in cells.values() if c is not None])
        return {gp: {"cell": {"lat": c[0], "lon": c[1]}, **data[c]} for gp, c in cells.items() if c is not None}


forecast_service = ForecastService()
