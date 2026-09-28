"""
Endpoint tests with a fake coarse forecast (no network) and synthetic Panchayats.
They use whatever models are in data/models (rainfall v1 is always committed).
"""
import pytest
from fastapi.testclient import TestClient

from app.inference import ModelRegistry
from app.main import MODELS_DIR, app, db
from app.services.forecast_service import snap_to_grid

client = TestClient(app)

FEATS = {
    "1": {"GPNAME": "Alpha", "blkname": "Haveli", "dtname": "Pune", "area_sqkm": 10.0, "elevation_mean": 600.0,
          "elevation_min": 550, "elevation_max": 700, "centroid_lat": 18.51, "centroid_lon": 73.76},
    "2": {"GPNAME": "Beta", "blkname": "Haveli", "dtname": "Pune", "area_sqkm": 30.0, "elevation_mean": 900.0,
          "elevation_min": 800, "elevation_max": 1100, "centroid_lat": 18.40, "centroid_lon": 73.60},
    "3": {"GPNAME": "Gamma", "blkname": "Baramati", "dtname": "Pune", "area_sqkm": 20.0, "elevation_mean": 550.0,
          "centroid_lat": 18.15, "centroid_lon": 74.58},
}
DATES = ["2026-07-01", "2026-07-02", "2026-07-03"]


class FakeForecast:
    def __init__(self):
        self.calls = 0

    def _cell(self, feat):
        lat, lon = snap_to_grid(feat["centroid_lat"], feat["centroid_lon"])
        rain = 10.0 if lat > 18.3 else 2.0
        return {
            "cell": {"lat": lat, "lon": lon},
            "cell_elevation_m": 650.0,
            "days": [{"date": d, "rainfall": rain + i, "tmax": 29.0, "tmin": 22.0, "rh": 88.0, "wind": 12.0}
                     for i, d in enumerate(DATES)],
        }

    def for_panchayat(self, feat):
        self.calls += 1
        return self._cell(feat)

    def for_panchayats(self, feats):
        self.calls += 1
        return {gp: self._cell(f) for gp, f in feats.items()}


@pytest.fixture(autouse=True)
def fake_env():
    saved = {k: db[k] for k in ("features_dict", "forecast", "registry")}
    db["features_dict"] = FEATS
    db["forecast"] = FakeForecast()
    db["registry"] = ModelRegistry(MODELS_DIR)
    yield
    db.update(saved)


def test_forecast_multivariable_schema_and_legacy_fields():
    r = client.get("/api/v1/panchayats/1/weather/forecast")
    assert r.status_code == 200
    body = r.json()
    assert body["validation_scope"] == "historical_2023"
    day = body["forecast"][0]
    for var in ("rainfall", "tmax", "tmin", "rh", "wind"):
        assert var in day and day[var]["coarse"] is not None and day[var]["value"] is not None
    assert day["rainfall"]["value"] >= 0
    assert 0 <= day["rh"]["value"] <= 100
    # legacy flat fields kept for one release
    assert day["final_downscaled_prediction_mm"] == day["rainfall"]["value"]
    assert day["era5_baseline_input_mm"] == day["rainfall"]["coarse"]


def test_temperature_baseline_uses_lapse_rate_when_untrained():
    body = client.get("/api/v1/panchayats/2/weather/forecast").json()
    t = body["forecast"][0]["tmax"]
    if not t["downscaled"]:
        # 900 m Panchayat vs 650 m cell -> 250 m higher -> 1.625 °C cooler
        assert t["baseline"] == pytest.approx(29.0 - 1.625, abs=0.01)


def test_quantiles_ordered_when_present():
    for d in client.get("/api/v1/panchayats/1/weather/forecast").json()["forecast"]:
        for var in ("rainfall", "tmax", "tmin", "rh", "wind"):
            v = d[var]
            if v["p10"] is not None:
                assert v["p10"] <= v["p50"] <= v["p90"]


def test_unknown_panchayat_404():
    assert client.get("/api/v1/panchayats/999/weather/forecast").status_code == 404
    assert client.get("/api/v1/panchayats/999/advisory").status_code == 404


def test_advisory_endpoint_returns_codes():
    body = client.get("/api/v1/panchayats/1/advisory", params={"crop": "Rice"}).json()
    assert body["crop"] == "rice"
    ids = [i["id"] for i in body["items"]]
    assert ids == ["irrigation", "spraying", "heat", "pest", "field"]
    assert all("." in i["code"] for i in body["items"])
    pest = next(i for i in body["items"] if i["id"] == "pest")
    assert pest["code"] == "pest.high"  # RH 88, Tmean 25.5 for 3 days


def test_map_forecast_single_upstream_call():
    fake = db["forecast"]
    r = client.get("/api/v1/map/forecast", params={"var": "rainfall", "date": DATES[1]})
    assert r.status_code == 200
    body = r.json()
    assert set(body["values"]) == {"1", "2", "3"}
    assert body["dates"] == DATES
    assert fake.calls == 1
    assert client.get("/api/v1/map/forecast", params={"var": "snow"}).status_code == 400
    assert client.get("/api/v1/map/forecast", params={"date": "1999-01-01"}).status_code == 400


def test_blocks_list():
    blocks = client.get("/api/v1/blocks").json()["blocks"]
    assert [b["block"] for b in blocks] == ["Baramati", "Haveli"]
    assert blocks[1]["panchayat_count"] == 2


def test_block_forecast_area_weighted_and_spread():
    body = client.get("/api/v1/blocks/haveli/forecast").json()
    assert body["panchayat_count"] == 2
    day = body["days"][0]
    # Both Haveli cells have rain 10 -> area-weighted block mean 10
    assert day["block_value"]["rainfall"] == pytest.approx(10.0)
    assert len(day["panchayats"]) == 2
    s = day["spread"]["tmax"]
    assert s["min"] <= s["mean"] <= s["max"]
    assert client.get("/api/v1/blocks/nowhere/forecast").status_code == 404


def test_block_downscale_user_supplied():
    r = client.post("/api/v1/blocks/Haveli/downscale", json={
        "days": [{"date": "2026-07-10", "rainfall": 40, "tmax": 31}],
    })
    assert r.status_code == 200
    body = r.json()
    assert body["input"] == "user_supplied_block_forecast"
    pans = body["days"][0]["panchayats"]
    assert {p["gpcode"] for p in pans} == {"1", "2"}
    assert all("rh" not in p for p in pans)  # only supplied variables are downscaled
    # Higher Panchayat is cooler (lapse-rate baseline around the block-mean elevation)
    t = {p["gpcode"]: p["tmax"]["baseline"] for p in pans}
    assert t["2"] < t["1"]


@pytest.mark.parametrize("payload", [
    {"days": [{"date": "2026-07-10"}]},
    {"days": [{"date": "10-07-2026", "rainfall": 3}]},
    {"days": [{"date": "2026-07-10", "rainfall": -1}]},
    {"days": [{"date": "2026-07-10", "rh": 140}]},
    {"days": []},
])
def test_block_downscale_validation(payload):
    assert client.post("/api/v1/blocks/Haveli/downscale", json=payload).status_code in (400, 422)


def test_metrics_endpoint():
    body = client.get("/api/v1/metrics").json()
    assert body["validation_scope"] == "historical_2023"
    assert "rainfall" in body["variables_loaded"]
