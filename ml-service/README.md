# SHMS ML Wait-Time Prediction Service

Machine learning microservice for dynamic patient wait-time prediction in the Smart Hospital Management System (SHMS). It provides accurate, feature-aware estimates of consultation waiting times using doctor experience, queue dynamics, department baselines, and temporal peak effects.

---

## 1. Environment Setup & Requirements

### Prerequisites
- Python 3.10+ (tested on Python 3.11.18)
- Virtual environment (`venv` or `uv`)

### Installation
From the `ml-service` directory:

```bash
# Using Python venv
python -m venv .venv

# Activate environment
# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# Linux / macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Dependencies (`requirements.txt`)
- `fastapi>=0.115.0`
- `uvicorn[standard]>=0.30.0`
- `scikit-learn>=1.5.0`
- `pandas>=2.2.0`
- `numpy>=2.0.0`
- `joblib>=1.4.0`
- `pydantic>=2.8.0`
- `pytest>=8.0.0`
- `httpx>=0.27.0`

---

## 2. Dataset Generation (`generate_data.py`)

Due to the absence of historical electronic health record (EHR) wait logs in the fresh database, a synthetic dataset was constructed using reproducible clinical heuristics.

To regenerate the dataset:
```bash
python generate_data.py
```
Output: `data/synthetic_hospital_wait_data.csv` (10,000 samples, fixed `random_state=42`).

### Feature Schema
| Feature | Type | Range / Domain | Description |
|---|---|---|---|
| `queue_length` | Integer | 0 – 15 | Number of patients ahead in-queue or in-consultation |
| `day_of_week` | Integer | 0 – 6 | Monday (0) to Sunday (6) |
| `hour` | Integer | 8 – 20 | Asia/Kolkata hour of consultation |
| `department` | String | Cardiology, Orthopedics, Pediatrics, General Medicine, Dermatology, Neurology, ENT, Ophthalmology | Hospital specialty |
| `doctor_experience` | Integer | 1 – 35 | Years of clinical practice |
| `actual_wait_minutes` | Float / Int | Target variable | Observed wait time before consultation starts |

---

## 3. Model Training & Evaluation (`train.py`)

To train and evaluate models:
```bash
python train.py
```

### Pipeline Architecture
- **Categorical Feature (`department`)**: `OneHotEncoder(handle_unknown="ignore")`
- **Numerical Features (`queue_length`, `day_of_week`, `hour`, `doctor_experience`)**: `StandardScaler()`
- **Estimator**: `RandomForestRegressor(n_estimators=100, max_depth=12, min_samples_leaf=3, random_state=42)`
- Serialized to `models/wait_time_model.joblib` with metadata in `models/metrics.json`.

### Evaluation Results (2,000 holdout test samples)
| Model / Baseline | MAE (min) | RMSE (min) | R² Score | Description |
|---|---|---|---|---|
| **RandomForestRegressor (Trained)** | **2.40** | **3.07** | **0.9912** | **Full feature ML model** |
| Linear Regression | 6.53 | 9.18 | 0.9216 | Linear baseline |
| Heuristic Formula (`5 + queue * 8`) | 12.20 | 18.56 | 0.6797 | Backend fallback baseline |
| Mean Baseline | 25.11 | 32.80 | -0.0007 | Naive mean prediction |

**Key Improvement**: The Random Forest model demonstrates an **80.3% MAE reduction** compared to the static heuristic formula by modeling non-linear department consultation lengths, doctor efficiency curves, and clinic peak hours.

---

## 4. Running the Service

### Start Local Server
```bash
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

### Health Check Endpoint
- **URL**: `GET /health`
- **Response**:
```json
{
  "status": "ok",
  "model_loaded": true,
  "version": "1.0.0"
}
```

### Prediction Endpoint
- **URL**: `POST /predict`
- **Request Body**:
```json
{
  "queue_length": 3,
  "day_of_week": 1,
  "hour": 11,
  "department": "Cardiology",
  "doctor_experience": 10
}
```
- **Response**:
```json
{
  "predicted_wait_minutes": 32
}
```

---

## 5. Automated Tests

Run unit and integration tests using pytest:
```bash
pytest tests/ -v
```
All 9 test cases cover:
- Health check verification
- Valid prediction ranges and types
- Rejection of invalid inputs (negative queue length, negative experience)
- Missing field validation (Pydantic 422)
- Handling of unseen hospital departments (graceful fallback via OneHotEncoder `handle_unknown='ignore'`)
- Clamping of output (no negative wait minutes)

---

## 6. Assumptions & Limitations of Synthetic Dataset

1. **Synthetic Nature**: Generated using clinical heuristics rather than live hospital telemetry. While distributions match empirical outpatient department (OPD) patterns, real hospital variance may exhibit higher skew from emergencies.
2. **Emergency Cases**: The model assumes regular OPD queuing and does not currently accommodate emergency department preemption.
3. **Continuous Retraining**: As the SHMS system accumulates real consultation timestamps (`checkInTime` to `consultationStartTime`), this service should be retrained periodically on genuine historical data.
