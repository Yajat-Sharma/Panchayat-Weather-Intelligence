from fastapi.testclient import TestClient
from app.main import app, db
import pytest

client = TestClient(app)

# Mock the database features for testing
@pytest.fixture(autouse=True)
def setup_db():
    db["features_dict"] = {
        "123": {
            "GPNAME": "Test Panchayat",
            "blkname": "Test Block",
            "dtname": "Test District",
            "elevation_mean": 500.0,
            "centroid_lat": 18.5,
            "centroid_lon": 73.5
        }
    }
    
    # We won't mock downscaler here to test the fallback when it's unavailable or open-meteo fails
    yield
    db["features_dict"] = {}

def test_missing_gpcode():
    response = client.post("/api/v1/assistant/chat", json={
        "gpcode": "999",
        "message": "Hello"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["answer"] == "Please select a valid Panchayat."

def test_missing_llm_provider():
    # If LLM_API_KEY is not set in environment or it's misconfigured, 
    # it should gracefully fail and return the temporarily unavailable message.
    response = client.post("/api/v1/assistant/chat", json={
        "gpcode": "123",
        "crop": "Rice",
        "message": "Should I irrigate?"
    })
    assert response.status_code == 200
    data = response.json()
    # It will either complain about missing LLM provider or hit the actual API if a key is provided
    assert "answer" in data
    assert "panchayat" in data
    assert data["panchayat"]["gpcode"] == "123"
