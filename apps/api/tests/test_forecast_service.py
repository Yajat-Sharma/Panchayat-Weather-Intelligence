import pytest

from app.services.forecast_service import ForecastService, snap_to_grid


class FakeResp:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self.payload


def make_http(calls):
    def http_get(url, params=None, timeout=None):
        calls.append(params)
        lats = params["latitude"].split(",")
        out = []
        for i, _ in enumerate(lats):
            out.append({
                "elevation": 500.0 + i,
                "daily": {
                    "time": ["2026-01-01", "2026-01-02"],
                    "precipitation_sum": [1.0 + i, None],
                    "temperature_2m_max": [30.0, 31.0],
                    "temperature_2m_min": [18.0, 19.0],
                    "relative_humidity_2m_mean": [60, 70],
                    "wind_speed_10m_mean": [8.0, 9.0],
                },
            })
        return FakeResp(out if len(out) > 1 else out[0])
    return http_get


@pytest.mark.parametrize("lat,lon,expected", [
    (18.52, 73.86, (18.5, 73.75)),
    (18.63, 73.88, (18.75, 74.0)),
    (18.375, 73.625, (18.5, 73.5)),  # round-half-even on the exact edge is fine, just deterministic
])
def test_snap_to_grid(lat, lon, expected):
    assert snap_to_grid(lat, lon) == expected


def test_nearby_panchayats_share_one_cell_and_one_request():
    calls = []
    svc = ForecastService(http_get=make_http(calls))
    feats = {
        "1": {"centroid_lat": 18.51, "centroid_lon": 73.74},
        "2": {"centroid_lat": 18.55, "centroid_lon": 73.80},
        "3": {"centroid_lat": 19.01, "centroid_lon": 74.20},
    }
    out = svc.for_panchayats(feats)
    assert len(calls) == 1
    assert calls[0]["elevation"] == "nan,nan"  # 2 unique cells, elevation correction disabled
    assert out["1"]["cell"] == out["2"]["cell"]
    assert out["1"]["days"][0]["rainfall"] is not None
    assert out["1"]["days"][1]["rainfall"] is None  # missing values pass through as None


def test_cache_hits_do_not_refetch_and_prime_covers_district():
    calls = []
    svc = ForecastService(http_get=make_http(calls))
    feats = {"1": {"centroid_lat": 18.5, "centroid_lon": 73.75}, "2": {"centroid_lat": 19.0, "centroid_lon": 74.25}}
    svc.prime(feats)
    svc.for_panchayat(feats["1"])
    svc.for_panchayat(feats["2"])
    svc.for_panchayats(feats)
    assert len(calls) == 1
    assert len(calls[0]["latitude"].split(",")) == 2


def test_cache_expires():
    calls = []
    svc = ForecastService(ttl_s=0, http_get=make_http(calls))
    f = {"centroid_lat": 18.5, "centroid_lon": 73.75}
    svc.for_panchayat(f)
    svc.for_panchayat(f)
    assert len(calls) == 2


def test_missing_centroid_raises():
    svc = ForecastService(http_get=make_http([]))
    with pytest.raises(ValueError):
        svc.for_panchayat({"centroid_lat": None, "centroid_lon": 73.0})
