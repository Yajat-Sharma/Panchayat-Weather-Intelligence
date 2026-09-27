import pytest
from apps.api.app.models.geospatial import District, Block, Panchayat
from apps.api.app.models.weather import WeatherObservation, WeatherForecast, WeatherPrediction, ValidationResult, Advisory

def test_geospatial_models_exist():
    assert District.__tablename__ == 'districts'
    assert Block.__tablename__ == 'blocks'
    assert Panchayat.__tablename__ == 'panchayats'

def test_weather_models_exist():
    assert WeatherObservation.__tablename__ == 'weather_observations'
    assert WeatherForecast.__tablename__ == 'weather_forecasts'
    assert WeatherPrediction.__tablename__ == 'weather_predictions'
    assert ValidationResult.__tablename__ == 'validation_results'
    assert Advisory.__tablename__ == 'advisories'
