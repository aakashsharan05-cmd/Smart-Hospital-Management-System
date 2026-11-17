"""
FastAPI Wait-Time Prediction Microservice
Serves the scikit-learn RandomForestRegressor pipeline for estimating patient wait times.
"""

import os
import json
from contextlib import asynccontextmanager
from typing import Optional
import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Model artifact path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "models", "wait_time_model.joblib")
METRICS_PATH = os.path.join(BASE_DIR, "models", "metrics.json")

# Global pipeline instance and typical error (MAE on held-out validation residuals)
model_pipeline = None
typical_error_minutes: Optional[float] = None

def load_metrics():
    global typical_error_minutes
    if os.path.exists(METRICS_PATH):
        try:
            with open(METRICS_PATH, "r") as f:
                data = json.load(f)
                mae = data.get("metrics", {}).get("random_forest", {}).get("mae")
                if mae is not None:
                    typical_error_minutes = round(float(mae), 1)
                    print(f"[FastAPI] Loaded typical error (MAE on validation residuals): ±{typical_error_minutes} min")
                else:
                    typical_error_minutes = None
        except Exception as e:
            print(f"[FastAPI] Note: Error reading metrics.json: {e}")
            typical_error_minutes = None
    else:
        typical_error_minutes = None

def load_model():
    global model_pipeline
    load_metrics()
    if os.path.exists(MODEL_PATH):
        try:
            model_pipeline = joblib.load(MODEL_PATH)
            print(f"[FastAPI] Successfully loaded ML pipeline from: {MODEL_PATH}")
            return model_pipeline
        except Exception as e:
            print(f"[FastAPI] Warning: Failed to load model artifact: {e}")
            model_pipeline = None
            return None
    else:
        print(f"[FastAPI] Warning: Model artifact not found at {MODEL_PATH}")
        model_pipeline = None
        return None

# Load model upon initialization
load_model()

@asynccontextmanager
async def lifespan(app: FastAPI):
    global model_pipeline
    if model_pipeline is None:
        load_model()
    yield

app = FastAPI(
    title="SHMS Wait-Time Prediction Service",
    description="Machine learning service predicting patient wait times in hospital OPD queues",
    version="1.0.0",
    lifespan=lifespan,
)

# Allowed backend origins for internal server-to-server communication
ALLOWED_BACKEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:5000,http://127.0.0.1:5000").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_BACKEND_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

class WaitPredictionRequest(BaseModel):
    queue_length: int = Field(
        ...,
        ge=0,
        description="Number of patients waiting ahead in queue (non-negative integer)",
        examples=[5],
    )
    day_of_week: int = Field(
        ...,
        ge=0,
        le=6,
        description="Day of week index in Asia/Kolkata (0=Monday .. 6=Sunday)",
        examples=[1],
    )
    hour: int = Field(
        ...,
        ge=0,
        le=23,
        description="Current hour of day in Asia/Kolkata (0-23)",
        examples=[14],
    )
    department: str = Field(
        ...,
        min_length=1,
        description="Department name (e.g. Cardiology, Orthopedics, General Medicine)",
        examples=["Cardiology"],
    )
    doctor_experience: int = Field(
        default=5,
        ge=0,
        le=60,
        description="Years of experience of the attending doctor",
        examples=[10],
    )

class WaitPredictionResponse(BaseModel):
    predicted_wait_minutes: int = Field(
        ...,
        ge=0,
        description="Predicted wait time in minutes (non-negative integer)",
        examples=[45],
    )
    typical_error_minutes: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Typical prediction error (Mean Absolute Error on hold-out validation residuals)",
    )

class BatchWaitPredictionRequest(BaseModel):
    items: list[WaitPredictionRequest] = Field(
        ...,
        description="List of wait prediction requests for queue items",
    )

class BatchWaitPredictionResponse(BaseModel):
    predictions: list[WaitPredictionResponse] = Field(
        ...,
        description="List of prediction responses in matching order",
    )

@app.get("/health", status_code=status.HTTP_200_OK)
def health_check():
    return {
        "status": "ok",
        "service": "wait-time-prediction",
        "model_loaded": model_pipeline is not None,
        "typical_error_minutes": typical_error_minutes,
        "model_file": os.path.basename(MODEL_PATH) if model_pipeline is not None else None,
    }

@app.post(
    "/predict",
    response_model=WaitPredictionResponse,
    status_code=status.HTTP_200_OK,
)
def predict_wait_time(request: WaitPredictionRequest):
    if model_pipeline is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Wait-time prediction model is not loaded or unavailable",
        )

    try:
        # Construct single-row DataFrame matching training feature columns
        input_df = pd.DataFrame([{
            "queue_length": request.queue_length,
            "day_of_week": request.day_of_week,
            "hour": request.hour,
            "department": request.department.strip(),
            "doctor_experience": request.doctor_experience,
        }])

        raw_pred = model_pipeline.predict(input_df)[0]

        # Enforce non-negative integer prediction
        predicted_minutes = max(0, int(round(float(raw_pred))))

        return WaitPredictionResponse(
            predicted_wait_minutes=predicted_minutes,
            typical_error_minutes=typical_error_minutes,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference error during wait-time prediction: {str(e)}",
        )

@app.post(
    "/predict-batch",
    response_model=BatchWaitPredictionResponse,
    status_code=status.HTTP_200_OK,
)
def predict_wait_time_batch(request: BatchWaitPredictionRequest):
    if model_pipeline is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Wait-time prediction model is not loaded or unavailable",
        )

    if not request.items:
        return BatchWaitPredictionResponse(predictions=[])

    try:
        rows = [
            {
                "queue_length": item.queue_length,
                "day_of_week": item.day_of_week,
                "hour": item.hour,
                "department": item.department.strip(),
                "doctor_experience": item.doctor_experience,
            }
            for item in request.items
        ]
        input_df = pd.DataFrame(rows)
        raw_preds = model_pipeline.predict(input_df)

        predictions = [
            WaitPredictionResponse(
                predicted_wait_minutes=max(0, int(round(float(p)))),
                typical_error_minutes=typical_error_minutes,
            )
            for p in raw_preds
        ]

        return BatchWaitPredictionResponse(predictions=predictions)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference error during batch prediction: {str(e)}",
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=False)
