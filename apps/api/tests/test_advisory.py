import pytest

from app.services.advisory_service import build_advisory, rain_probability


def day(rain=0.0, tmax=30.0, tmin=20.0, rh=60.0, wind=5.0, prob=None, p10=None, p90=None):
    return {
        "date": "2026-01-01",
        "rainfall": {"value": rain, "p50": rain, "p10": p10, "p90": p90, "prob": prob},
        "tmax": {"value": tmax},
        "tmin": {"value": tmin},
        "rh": {"value": rh},
        "wind": {"value": wind},
    }


def item(adv, rid):
    return next(i for i in adv["items"] if i["id"] == rid)


@pytest.mark.parametrize("days,crop,code", [
    ([day(10), day(10), day(5)], "Soybean", "irrigation.skip"),        # 25 mm >= 15
    ([day(4), day(4), day(0)], "Soybean", "irrigation.reduce"),        # 8 mm >= 7.5
    ([day(0), day(0), day(0)], "Soybean", "irrigation.needed"),
    ([day(10), day(10), day(0)], "Rice", "irrigation.reduce"),         # rice needs 25 mm
    ([day(0, prob=0.7), day(0), day(0)], "Maize", "irrigation.skipLikelyRain"),
])
def test_irrigation(days, crop, code):
    assert item(build_advisory(days, crop), "irrigation")["code"] == code


@pytest.mark.parametrize("d0,code", [
    (day(wind=20), "spray.avoidWind"),
    (day(rain=5), "spray.avoidRain"),
    (day(prob=0.55), "spray.avoidRain"),
    (day(), "spray.ok"),
])
def test_spraying(d0, code):
    assert item(build_advisory([d0, day(), day()], "Rice"), "spraying")["code"] == code


@pytest.mark.parametrize("tmax,crop,code", [
    (36, "Vegetables", "heat.stress"),  # veg critical 32
    (36, "Sugarcane", "heat.watch"),     # sugarcane critical 38
    (30, "Rice", "heat.ok"),
])
def test_heat(tmax, crop, code):
    assert item(build_advisory([day(tmax=tmax)], crop), "heat")["code"] == code


def test_fungal_needs_consecutive_humid_mild_days():
    humid = dict(rh=90, tmax=28, tmin=22)
    adv = build_advisory([day(**humid), day(**humid), day()], "Rice")
    assert item(adv, "pest")["code"] == "pest.high"
    assert item(adv, "pest")["params"]["days"] == 2
    adv = build_advisory([day(**humid), day(), day(**humid)], "Rice")
    assert item(adv, "pest")["code"] == "pest.watch"
    hot = dict(rh=90, tmax=38, tmin=30)  # too warm (mean 34)
    assert item(build_advisory([day(**hot), day(**hot)], "Rice"), "pest")["code"] == "pest.low"


def test_field_work_heavy_rain_in_window():
    adv = build_advisory([day(0), day(0), day(45)], "Maize")
    f = item(adv, "field")
    assert f["code"] == "field.delay" and f["params"]["dayOffset"] == 2
    assert item(build_advisory([day(5)], "Maize"), "field")["code"] == "field.ok"


def test_start_offset_and_unknown_crop():
    adv = build_advisory([day(50), day(0), day(0), day(0)], "Cotton", start=1)
    assert adv["crop_known"] is False
    assert item(adv, "field")["code"] == "field.ok"


def test_missing_variables_degrade_to_unknown():
    d = {"date": "2026-01-01", "rainfall": {"value": 0.0}}
    adv = build_advisory([d], "Rice")
    assert item(adv, "heat")["code"] == "heat.unknown"
    assert item(adv, "pest")["code"] == "pest.unknown"
    assert item(adv, "spraying")["code"] == "spray.ok"


def test_rain_probability_proxy_from_quantiles():
    assert rain_probability(day(rain=1, p10=0, p90=6)) == (0.3, "quantile_proxy")
    assert rain_probability(day(rain=1, prob=0.42)) == (0.42, "classifier")
    assert rain_probability(day(rain=5)) == (1.0, "deterministic")


def test_empty_forecast():
    assert build_advisory([], "Rice")["status"] == "NO_FORECAST"
