"""
Pytest Suite for FastAPI Wait-Time Prediction Service
"""

import os
import sys
import pytest
from fastapi.testclient import TestClient

# Ensure ml-service root is on python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app, model_pipeline, MODEL_PATH

@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client

def test_model_artifact_exists():
    """Verify that trained model artifact exists on disk."""
    assert os.path.exists(MODEL_PATH), f"Model file missing at: {MODEL_PATH}"

def test_health_endpoint(client):
    """Test GET /health returns 200 with model_loaded: True."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["model_loaded"] is True
    assert data["model_file"] == "wait_time_model.joblib"

def test_valid_prediction(client):
    """Test valid prediction request returns 200 with integer predicted_wait_minutes."""
    payload = {
        "queue_length": 5,
        "day_of_week": 1,
        "hour": 14,
        "department": "Cardiology",
        "doctor_experience": 10,
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "predicted_wait_minutes" in data
    assert isinstance(data["predicted_wait_minutes"], int)
    assert data["predicted_wait_minutes"] >= 0
    assert "typical_error_minutes" in data
    assert isinstance(data["typical_error_minutes"], (int, float))
    assert data["typical_error_minutes"] > 0
    # For queue_length 5 in Cardiology, wait should be roughly 50-80 min
    assert 30 <= data["predicted_wait_minutes"] <= 120

def test_zero_queue_length(client):
    """Test prediction for zero queue length is non-negative and realistic."""
    payload = {
        "queue_length": 0,
        "day_of_week": 2,
        "hour": 10,
        "department": "General Medicine",
        "doctor_experience": 15,
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["predicted_wait_minutes"] >= 0
    assert data["predicted_wait_minutes"] <= 15

def test_unknown_department(client):
    """Test unseen department does not crash model (graceful OneHotEncoder ignore)."""
    payload = {
        "queue_length": 3,
        "day_of_week": 0,
        "hour": 11,
        "department": "Specialized Oncology",
        "doctor_experience": 12,
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data["predicted_wait_minutes"], int)
    assert data["predicted_wait_minutes"] >= 0

def test_invalid_negative_queue_rejected(client):
    """Test Pydantic rejects negative queue length with HTTP 422."""
    payload = {
        "queue_length": -2,
        "day_of_week": 1,
        "hour": 14,
        "department": "Cardiology",
        "doctor_experience": 10,
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 422

def test_invalid_day_of_week_rejected(client):
    """Test day_of_week must be in range 0..6."""
    payload = {
        "queue_length": 3,
        "day_of_week": 7,
        "hour": 14,
        "department": "Cardiology",
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 422

def test_invalid_negative_experience_rejected(client):
    """Test doctor_experience cannot be negative."""
    payload = {
        "queue_length": 3,
        "day_of_week": 1,
        "hour": 14,
        "department": "Cardiology",
        "doctor_experience": -1,
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 422

def test_empty_department_rejected(client):
    """Test empty department string is rejected."""
    payload = {
        "queue_length": 3,
        "day_of_week": 1,
        "hour": 14,
        "department": "",
        "doctor_experience": 5,
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 422
