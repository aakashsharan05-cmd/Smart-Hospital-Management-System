# Smart Hospital Management System (SHMS)

A full-stack, enterprise-grade Hospital Management System built on the MERN stack (MongoDB, Express 5, React 19, Node.js) paired with a dedicated Python Machine Learning microservice for dynamic patient wait-time prediction and Google Gemini for privacy-preserving clinical symptom triage.

---

## 1. System Architecture & Technology Stack

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        React 19 Client Portal                          │
│               Vite + Tailwind CSS + Lucide / React Icons               │
│               Role-tailored dashboards & Real-time WebSockets          │
└───────────────────▲────────────────────────────────▲───────────────────┘
                    │ REST API                       │ Socket.IO
                    ▼                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      Node.js / Express 5 API Gateway                   │
│   • JWT Auth & Inactive-User Invalidation                              │
│   • Asia/Kolkata Business Logic & Slot Boundary Normalization          │
│   • Atomic Daily Counters (counters collection + findOneAndUpdate)     │
│   • Legal Status State Machine (src/services/appointmentStatus.js)     │
│   • Rate Limiting (express-rate-limit) & Role-based Authorization       │
└───────────────▲───────────────────────────▲──────────────────▲─────────┘
                │                           │                  │
                ▼                           ▼                  ▼
┌──────────────────────────┐    ┌────────────────────┐    ┌──────────────┐
│     MongoDB 7.0+         │    │  Python ML Service │    │ Google Gemini│
│  (Replica Set Required)  │    │  (FastAPI / UV)    │    │  (REST API)  │
│ • ACID Transactions      │    │ • Scikit-learn RF  │    │ • Symptom    │
│ • Partial Unique Indexes │    │ • 1.5s Timeout     │    │   Triage     │
│ • Invoices & Queues      │    │ • Heuristic Fallback│   │ • 3s Timeout │
└──────────────────────────┘    └────────────────────┘    └──────────────┘
```

### Technology Stack
- **Backend**: Node.js (v20+), Express 5, Mongoose 9, Socket.IO 4, Helmet, Express-Rate-Limit, Bcrypt.js, JsonWebToken.
- **Frontend**: React 19, Vite, Tailwind CSS, React Router 7, Socket.io-client.
- **Machine Learning**: Python 3.11, FastAPI, Uvicorn, Scikit-learn, Pandas, NumPy, Joblib, Pydantic, Pytest.
- **Database**: MongoDB (Local Replica Set or Atlas Cluster) supporting multi-document ACID transactions.
- **External AI**: Google Gemini API (`gemini-1.5-flash` / `gemini-2.0-flash`).

---

## 2. Prerequisites

- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **MongoDB**: MongoDB 6.0+ instance configured as a **Replica Set** (required for multi-document ACID transactions) or a free MongoDB Atlas cluster.
- **Python**: v3.10+ (v3.11 recommended) with `venv` or `uv`.
- **Package Managers**: `npm` (v9+) and `pip`.

---

## 3. Project Directory Structure

```text
SHMS/
├── src/
│   ├── app.js               # Express application middleware & route mounting
│   ├── db/db.js             # Mongoose connection logic
│   ├── middleware/          # Auth, role authorization, rate limiters, error handler
│   ├── models/              # Mongoose models (User, Doctor, Department, Appointment, Billing...)
│   ├── controllers/         # Request handling & HTTP response contracts
│   ├── services/            # Core business logic:
│   │   ├── appointmentStatus.service.js  # Centralized state machine & transactions
│   │   ├── waitPrediction.js             # Canonical wait prediction interface
│   │   ├── waitPrediction.service.js     # FastAPI ML caller & heuristic fallback
│   │   ├── triage.service.js             # Gemini AI triage & active department validation
│   │   └── socket.service.js             # Authenticated Socket.IO with room isolation
│   ├── routes/              # Express API route declarations
│   └── utils/               # Asia/Kolkata timezone helpers & atomic counters
├── ml-service/              # Python FastAPI Machine Learning microservice
│   ├── app.py               # FastAPI server (GET /health, POST /predict)
│   ├── generate_data.py     # Reproducible synthetic OPD dataset generator
│   ├── train.py             # RandomForest model trainer & metrics evaluator
│   ├── data/                # Generated 10,000-sample dataset CSV
│   ├── models/              # Serialized pipeline (.joblib) and metrics JSON
│   ├── tests/               # Pytest suite
│   └── requirements.txt     # Python dependencies
├── frontend/                # React 19 + Vite client web application
├── tests/                   # Jest + Supertest integration test suite
├── scripts/
│   ├── createAdmin.js       # First-time bootstrap script for admin account
│   ├── verifyPhaseB4.js     # Integration test for Python ML microservice
│   └── verifyPhaseB5.js     # Integration test for Gemini AI triage
├── server.js                # Server entry point (HTTP + Socket.IO)
└── .env.example             # Template for required environment variables
```

---

## 4. Environment Configuration

Create a `.env` file in the project root:
```bash
cp .env.example .env
```

### Required Parameters
| Variable | Description | Default / Example |
|---|---|---|
| `PORT` | Node.js Express server port | `5000` |
| `CORS_ORIGIN` | Allowed client origin | `http://localhost:5173` |
| `JWT_SECRET` | Cryptographic secret for signing JWTs (min 32 chars) | `your_secret_at_least_32_characters_long` |
| `MONGOURL` | MongoDB Replica Set connection string | `mongodb://localhost:27017/SHMS?replicaSet=rs0` |
| `ADMIN_NAME` | Initial administrator full name | `"Hospital Administrator"` |
| `ADMIN_EMAIL` | Initial administrator login email | `admin@example.com` |
| `ADMIN_PASSWORD` | Initial administrator secure password | `AdminPassword123!` |
| `ADMIN_PHONE` | Initial administrator contact phone | `9876543210` |
| `ML_SERVICE_URL` | Base URL of the Python ML wait-prediction service | `http://localhost:8000` |
| `DEFAULT_CONSULT_MIN`| Fallback consultation minutes per waiting patient | `8` |
| `GEMINI_API_KEY` | Google Gemini API Key for AI Symptom Triage | *(Optional - falls back to keyword triage if omitted)* |
| `GEMINI_MODEL` | Gemini Model Identifier | `gemini-1.5-flash` |

---

## 5. Step-by-Step Installation & Running the Full Stack

### Step 1: Bootstrap Administrator Account
```bash
npm install
node scripts/createAdmin.js
```

### Step 2: Running All Services Together

Open 3 separate terminal tabs:

#### Terminal 1: Python ML Prediction Microservice
```bash
cd ml-service
python -m venv .venv

# Activate virtual environment
# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# Linux / macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI server on port 8000
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```
*Health check:* Verify `GET http://localhost:8000/health` returns `status: "ok"`.

#### Terminal 2: Node.js Backend API & Socket.IO Server
```bash
# In the root repository directory:
npm run dev
```
Backend runs on `http://localhost:5000`.

#### Terminal 3: React Frontend Application
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on `http://localhost:5173` with automatic reverse proxying for `/api` and `/socket.io`.

---

## 6. API Documentation & Example Requests

All API responses follow the standard format:
`{ "success": true|false, "message": "...", ...data }`

### A. Authentication
- **Register Patient**: `POST /api/auth/register`
  ```json
  { "name": "Jane Doe", "email": "jane@example.com", "password": "Password123!", "phone": "+919876543210" }
  ```
- **Login**: `POST /api/auth/login`
  ```json
  { "email": "jane@example.com", "password": "Password123!" }
  ```
  *Returns:* `{ "token": "...", "user": { ... } }`. Note: Inactive accounts (`isActive: false`) are rejected with `403 Forbidden`.

### B. AI Symptom Triage
- **Get Triage Suggestion**: `POST /api/appointments/triage` *(Patient role only, rate-limited to 10 req/min)*
  ```json
  { "symptomText": "Severe chest tightness and palpitations" }
  ```
  *Response:*
  ```json
  {
    "success": true,
    "triage": {
      "suggestedDepartment": "Cardiology",
      "urgency": "high",
      "disclaimer": "AI suggestion only, not a medical diagnosis."
    }
  }
  ```

### C. Appointments & Queue Management
- **Book Scheduled Appointment**: `POST /api/appointments` *(Patient role)*
  ```json
  {
    "doctorId": "65f1234567890abcdef12345",
    "appointmentDate": "2026-11-20T10:30:00.000Z",
    "reason": "Persistent migraine and dizziness"
  }
  ```
  *Note:* The server independently runs triage and saves `aiTriageSuggestion` on the appointment.
- **Register Walk-in Patient**: `POST /api/appointments/walk-in` *(Receptionist/Admin)*
  ```json
  {
    "doctorId": "65f1234567890abcdef12345",
    "patient": { "name": "John Walkin", "phone": "+919876500000" },
    "reason": "Acute ear pain"
  }
  ```
  *Note:* Deduplicates patients by phone number. If new, generates a secure random password and non-routable placeholder email. Placed directly into `"in-queue"`.
- **Check-in Scheduled Patient**: `PATCH /api/appointments/:id/check-in` *(Receptionist/Admin)*
  *Transitions:* `confirmed` $\rightarrow$ `in-queue`. Assigns timestamp and recalculates queue wait times.
- **Start Consultation**: `PATCH /api/appointments/:id/start-consultation` *(Attending Doctor only)*
  *Transitions:* `in-queue` $\rightarrow$ `in-consultation`.
- **End Consultation**: `PATCH /api/appointments/:id/end-consultation` *(Attending Doctor only)*
  *Transitions:* `in-consultation` $\rightarrow$ `completed`.
- **Get Live Wait Estimate**: `GET /api/appointments/:id/wait-estimate`
  *Response:*
  ```json
  {
    "success": true,
    "appointmentId": "65f1234567890abcdef12345",
    "status": "in-queue",
    "queueNumber": 3,
    "queuePosition": 1,
    "predictedWaitMinutes": 18,
    "typicalErrorMinutes": 2.4,
    "waitPredictionSource": "ml-model"
  }
  ```

### D. Billing Workflows
- **Generate Bill**: `POST /api/billing` *(Receptionist/Admin)*
  *Enforces Rule:* Only appointments with status `"completed"` can be billed. Attempting to bill incomplete appointments returns `400 Bad Request`. Uses atomic daily invoice numbering (`INV-YYYYMMDD-XXXX`).

---

## 7. Testing Suites & Verification

### Run Automated Tests
```bash
# 1. Run Backend Jest Integration Suite (7 suites, 17 tests with In-Memory MongoDB Replica Set)
npm test

# 2. Run Python ML Service Unit & Validation Suite (9 tests)
cd ml-service
.venv\Scripts\pytest tests/ -v

# 3. Run Real FastAPI + Node.js End-to-End Wait Prediction Suite
cd ..
node scripts/verifyPhaseB4.js

# 4. Run AI Triage & Gemini Integration Suite
node scripts/verifyPhaseB5.js

# 5. Run Frontend Production Build
cd frontend
npm run build
```

---

## 8. Limitations & Clinical Design Trade-offs

### 1. Synthetic Training Data Limitations
Due to the absence of historical electronic health records (EHR) in cold-start deployments, the wait-time model was trained on a calibrated 10,000-sample synthetic dataset. While distributions reflect empirical outpatient clinic operations (department baselines, doctor experience discount curves, and diurnal surge peaks), real hospital operations may exhibit higher variance from emergency room patient diversions. Periodic retraining on real accumulated consultation logs (`checkInTime` to `consultationStartTime`) is strongly recommended.

### 2. Wait-Time Estimates are NOT Guarantees
All wait-time predictions are explicitly labeled as approximate (`~X min`) with an honest empirical uncertainty metric (`Typical prediction error: 2.4 min`). Clinical complications, doctor availability shifts, or emergency triage can cause actual wait times to deviate.

### 3. AI Symptom Triage is NOT a Medical Diagnosis
The AI triage assistant is strictly designed for operational department routing and preliminary urgency categorization. It is **not** a diagnostic device and should never replace clinical examination. All triage responses carry the mandatory disclaimer:
> *"AI suggestion only, not a medical diagnosis."*

Patients presenting high-urgency symptoms are immediately instructed via high-contrast UI notices to contact local emergency services (112 / 102) or proceed to the nearest emergency department.
