from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
from .base import Base

class WeatherObservation(Base):
    __tablename__ = 'weather_observations'
    id = Column(Integer, primary_key=True, index=True)
    panchayat_id = Column(Integer, ForeignKey('panchayats.id'), index=True)
    timestamp = Column(DateTime(timezone=True), index=True)
    rainfall = Column(Float)
    temperature = Column(Float)
    source = Column(String)  # e.g., 'IMD_AWS', 'INSAT'

class WeatherForecast(Base):
    __tablename__ = 'weather_forecasts'
    id = Column(Integer, primary_key=True, index=True)
    panchayat_id = Column(Integer, ForeignKey('panchayats.id'), index=True)
    issue_time = Column(DateTime(timezone=True), index=True)
    valid_time = Column(DateTime(timezone=True), index=True)
    rainfall = Column(Float)
    temperature = Column(Float)
    source = Column(String)
    resolution = Column(String)  # e.g., '12km', 'block'

class WeatherPrediction(Base):
    __tablename__ = 'weather_predictions'
    id = Column(Integer, primary_key=True, index=True)
    panchayat_id = Column(Integer, ForeignKey('panchayats.id'), index=True)
    model_version = Column(String)
    issue_time = Column(DateTime(timezone=True), index=True)
    valid_time = Column(DateTime(timezone=True), index=True)
    rainfall = Column(Float)
    temperature = Column(Float)
    lower_bound_rainfall = Column(Float, nullable=True)
    upper_bound_rainfall = Column(Float, nullable=True)
    lower_bound_temperature = Column(Float, nullable=True)
    upper_bound_temperature = Column(Float, nullable=True)
    confidence = Column(String, nullable=True)

class ValidationResult(Base):
    __tablename__ = 'validation_results'
    id = Column(Integer, primary_key=True, index=True)
    model_version = Column(String, index=True)
    evaluation_period_start = Column(DateTime(timezone=True))
    evaluation_period_end = Column(DateTime(timezone=True))
    metrics = Column(JSON)  # Stores MAE, RMSE, Bias, POD, FAR, CSI

class Advisory(Base):
    __tablename__ = 'advisories'
    id = Column(Integer, primary_key=True, index=True)
    panchayat_id = Column(Integer, ForeignKey('panchayats.id'), index=True)
    issue_time = Column(DateTime(timezone=True), index=True)
    text = Column(String)
    rules_triggered = Column(JSON)
