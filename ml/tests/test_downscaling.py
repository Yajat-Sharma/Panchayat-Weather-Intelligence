import numpy as np
import pandas as pd
import pytest
import xarray as xr
from rasterio.transform import from_origin

from ml.downscaling.config import VARIABLES, feature_list
from ml.downscaling.physics import (
    area_weighted_block_mean, daily_ist, lapse_rate_baseline, magnus_rh, normalise_block, wind_speed_kmh,
)
from ml.downscaling.terrain import class_fractions, distance_to_class_km, slope_aspect, tpi
from ml.downscaling.training import cross_validate, fit_all, interval_stats, model_frame, order_quantiles


# ---- physics ------------------------------------------------------------------

def test_magnus_rh():
    assert magnus_rh(20.0, 20.0) == pytest.approx(100.0)
    assert magnus_rh(25.0, 15.0) == pytest.approx(53.8, abs=0.5)
    assert magnus_rh(10.0, 12.0) == 100.0  # supersaturated inputs are clipped
    assert np.all(np.diff(magnus_rh(30.0, np.array([5.0, 10.0, 20.0]))) > 0)


def test_wind_speed():
    assert wind_speed_kmh(3.0, 4.0) == pytest.approx(18.0)


def test_lapse_rate_baseline():
    out = lapse_rate_baseline([30.0, 30.0, 30.0], [1600.0, 600.0, np.nan], [600.0, 600.0, 600.0])
    assert out == pytest.approx([23.5, 30.0, 30.0])  # 1 km higher -> 6.5 °C cooler; NaN elevation -> coarse


def test_daily_ist_boundaries():
    times = pd.date_range("2023-01-01 00:00", periods=24 * 4, freq="h")
    da = xr.DataArray(np.ones((len(times), 2)), dims=("valid_time", "location"), coords={"valid_time": times})
    total = daily_ist(da, "sum")
    days = pd.to_datetime(total.valid_time.values).strftime("%Y-%m-%d").tolist()
    # 00 UTC Jan 1 is 05:30 IST: Jan 1 IST is partial and dropped; Jan 5 IST (from 18:30 UTC Jan 4) is partial too
    assert days == ["2023-01-02", "2023-01-03", "2023-01-04"]
    assert np.all(total.values == 24)

    # An IST day starts at 18:30 UTC the previous day: a value at 19:00 UTC Jan 2 belongs to Jan 3 IST.
    vals = np.zeros((len(times), 1))
    vals[times.get_loc(pd.Timestamp("2023-01-02 19:00"))] = 5.0
    da = xr.DataArray(vals, dims=("valid_time", "location"), coords={"valid_time": times})
    s = daily_ist(da, "sum")
    assert float(s.sel(valid_time="2023-01-03").values[0]) == 5.0
    assert float(s.sel(valid_time="2023-01-02").values[0]) == 0.0


def test_daily_ist_max_min():
    times = pd.date_range("2023-01-01", periods=72, freq="h")
    da = xr.DataArray(np.arange(72.0)[:, None], dims=("time", "location"), coords={"time": times})
    mx, mn = daily_ist(da, "max"), daily_ist(da, "min")
    # Jan 2 IST = UTC 18:30 Jan 1 .. 18:30 Jan 2 -> hourly stamps 19..42
    assert float(mx.sel(time="2023-01-02").values[0]) == 42
    assert float(mn.sel(time="2023-01-02").values[0]) == 19


def test_area_weighted_block_mean():
    df = pd.DataFrame({
        "block_key": ["a", "a", "b", "a"],
        "date": ["d1", "d1", "d1", "d2"],
        "area_sqkm": [1.0, 3.0, 2.0, 5.0],
        "x": [10.0, 20.0, 7.0, np.nan],
    })
    out = area_weighted_block_mean(df, ["x"])
    assert out["block_x"].tolist()[:3] == pytest.approx([17.5, 17.5, 7.0])
    assert np.isnan(out["block_x"].iloc[3])


def test_normalise_block():
    assert normalise_block(" HAVELI ") == normalise_block("Haveli") == "haveli"


# ---- terrain ------------------------------------------------------------------

def test_slope_aspect_on_tilted_plane():
    res = 1 / 1200  # ~90 m
    transform = from_origin(73.0, 19.0, res, res)
    rows, cols = np.mgrid[0:50, 0:50]
    dem = 1000.0 - rows * 10.0  # falls 10 m per row going south -> slope faces south
    slope, aspect = slope_aspect(dem, transform)
    inner = (slice(5, -5), slice(5, -5))
    expected = np.degrees(np.arctan(10.0 / (res * 110_540)))
    assert np.nanmean(slope[inner]) == pytest.approx(expected, rel=0.01)
    assert np.nanmean(aspect[inner]) == pytest.approx(180.0, abs=1.0)


def test_tpi():
    flat = np.full((20, 20), 500.0)
    assert np.allclose(tpi(flat, 3), 0.0)
    peak = flat.copy()
    peak[10, 10] = 600.0
    t = tpi(peak, 2)
    assert t[10, 10] > 90 and t[10, 10] == t.max()


def test_distance_and_fractions():
    transform = from_origin(73.0, 19.0, 0.001, 0.001)
    lc = np.full((30, 30), 40, dtype=np.uint8)
    lc[0, 0] = 80
    d = distance_to_class_km(lc, transform, 80)
    assert d[0, 0] == 0 and d[0, 10] == pytest.approx(10 * 0.001 * 111.32 * np.cos(np.deg2rad(19)), rel=0.05)
    fr = class_fractions({40: 6, 80: 2, 10: 2, 0: 100})
    assert fr["lc_cropland"] == 0.6 and fr["lc_water"] == 0.2 and fr["lc_built"] == 0.0


# ---- training -----------------------------------------------------------------

@pytest.fixture(scope="module")
def synthetic():
    """60 Panchayats x 60 days; fine truth = coarse + a terrain signal the model can learn."""
    rng = np.random.default_rng(0)
    n_gp, n_d = 60, 60
    gp = pd.DataFrame({
        "GPCODE": [str(i) for i in range(n_gp)],
        "centroid_lat": rng.uniform(18.0, 19.2, n_gp),
        "centroid_lon": rng.uniform(73.4, 75.0, n_gp),
        "elevation_mean": rng.uniform(450, 1200, n_gp),
        "area_sqkm": rng.uniform(2, 30, n_gp),
        "blkname": rng.choice(["A", "B", "C", "D"], n_gp),
    })
    for c in ("elevation_min", "elevation_max", "elevation_std", "elevation_p10", "elevation_p50", "elevation_p90"):
        gp[c] = gp["elevation_mean"] + rng.normal(0, 20, n_gp)
    dates = pd.date_range("2023-06-01", periods=n_d)
    df = gp.merge(pd.DataFrame({"date": dates}), how="cross")
    df["day_of_year"], df["month"] = df["date"].dt.dayofyear, df["date"].dt.month
    df["cell_elevation_m"] = 600.0
    df["elev_diff_m"] = df["elevation_mean"] - df["cell_elevation_m"]
    n = len(df)
    df["era5_rainfall_mm"] = rng.gamma(0.8, 6, n)
    df["target_rainfall_mm"] = np.maximum(0, df["era5_rainfall_mm"] * (1 + (df["elevation_mean"] - 600) / 800)
                                          + rng.normal(0, 1, n))
    df["era5_tmax_c"] = 30 + rng.normal(0, 2, n)
    df["fine_tmax_c"] = lapse_rate_baseline(df["era5_tmax_c"], df["elevation_mean"], 600.0) \
        + 0.5 * np.sin(df["centroid_lon"] * 5) + rng.normal(0, 0.3, n)
    df["block_key"] = df["blkname"].str.lower()
    df = pd.concat([df, area_weighted_block_mean(df, ["era5_rainfall_mm", "era5_tmax_c", "cell_elevation_m"])], axis=1)
    return df


def test_feature_lists():
    assert feature_list("rainfall", "v1")[0] == "era5_rainfall_mm"
    assert "cell_elevation_m" not in feature_list("rainfall")  # v1 rainfall schema unchanged
    assert "slope_mean" in feature_list("tmax", "v2") and "elev_diff_m" in feature_list("tmax")


def test_block_mode_replaces_coarse_input(synthetic):
    X, base = model_frame(synthetic, "tmax", "v1", mode="block")
    assert np.allclose(X["era5_tmax_c"], synthetic["block_era5_tmax_c"])
    assert np.allclose(X["cell_elevation_m"], synthetic["block_cell_elevation_m"])


@pytest.mark.parametrize("var", ["rainfall", "tmax"])
def test_cross_validation_beats_baseline_with_calibrated_interval(synthetic, var):
    m, oof = cross_validate(synthetic, var, "v1", uncertainty=True)
    assert m["point"]["model_rmse"] < m["point"]["baseline_rmse"]
    assert len(m["point"]["folds"]) == 5
    assert 0.6 < m["interval"]["coverage"] < 0.95
    assert (oof["p10"] <= oof["p50"]).all() and (oof["p50"] <= oof["p90"]).all()
    if var == "rainfall":
        assert (oof["downscaled"] >= 0).all()
        rp = m["rain_probability"]
        assert rp["brier"] < rp["brier_climatology"]


def test_block_mode_cross_validation(synthetic):
    m, _ = cross_validate(synthetic, "rainfall", "v1", mode="block")
    assert m["mode"] == "block" and np.isfinite(m["point"]["model_rmse"])


def test_fit_all_outputs(synthetic):
    out = fit_all(synthetic, "rainfall", "v1")
    assert set(out["models"]) == {"model", "p10", "p50", "p90", "rain_probability"}
    assert out["feature_order"] == feature_list("rainfall", "v1")
    assert "rain_probability" not in fit_all(synthetic, "rainfall", "v1", "block")["models"]


def test_order_quantiles_and_interval():
    q = order_quantiles({"p10": np.array([5.0, 1.0]), "p50": np.array([3.0, 2.0]), "p90": np.array([4.0, 3.0])})
    assert q["p10"].tolist() == [3.0, 1.0] and q["p90"].tolist() == [5.0, 3.0]
    s = interval_stats([1, 2, 3, 10], [0, 0, 0, 0], [5, 5, 5, 5])
    assert s["coverage"] == 0.75


def test_all_variables_configured():
    assert set(VARIABLES) == {"rainfall", "tmax", "tmin", "rh", "wind"}
