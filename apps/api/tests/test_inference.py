import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.inference import WeatherDownscaler
import pandas as pd

client = TestClient(app)

def test_live_inference_endpoint():
    response = client.get("/api/v1/panchayats/185262/weather/live?date=2023-07-15&era5_rainfall_mm=10.5")
    
    if response.status_code == 200:
        data = response.json()
        assert data["gpcode"] == "185262"
        assert data["date"] == "2023-07-15"
        assert "final_downscaled_prediction_mm" in data
        assert data["final_downscaled_prediction_mm"] >= 0.0 # Clipping test
        assert data["prediction_type"] == "historical_experimental_inference"
        assert "model_version" in data
    elif response.status_code == 404:
        pytest.skip("Panchayat data not seeded locally for testing.")
    elif response.status_code == 503:
        pytest.skip("Model not seeded locally for testing.")

def test_negative_rainfall_input():
    response = client.get("/api/v1/panchayats/185262/weather/live?date=2023-07-15&era5_rainfall_mm=-5.0")
    assert response.status_code == 400
    assert "negative" in response.json()["detail"].lower()

def test_invalid_date():
    response = client.get("/api/v1/panchayats/185262/weather/live?date=2023-13-45&era5_rainfall_mm=10.5")
    assert response.status_code == 400

def test_batch_inference():
    payload = [
        {"gpcode": "185262", "date": "2023-07-15", "era5_rainfall_mm": 15.0},
        {"gpcode": "185262", "date": "2023-07-15", "era5_rainfall_mm": -10.0} # invalid
    ]
    response = client.post("/api/v1/panchayats/weather/batch", json=payload)
    
    if response.status_code == 200:
        results = response.json()["results"]
        assert len(results) == 2
        assert results[0]["final_downscaled_prediction_mm"] >= 0
        assert "error" in results[1] # Negative rainfall should be caught
    elif response.status_code == 503:
        pytest.skip("Model not seeded locally for testing.")
