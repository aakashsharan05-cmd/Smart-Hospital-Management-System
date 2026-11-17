# Smart Hospital Management System (SHMS)

A full-stack Hospital Management System built on the MERN stack (MongoDB, Express, React, Node.js) with role-based access control, real-time queues, prescription and billing workflows, and AI-assisted triage and waiting-time estimation.

---

## 1. Prerequisites

- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **MongoDB**: MongoDB Atlas cluster or local MongoDB instance (Replica Set required for transactions)
- **Python**: v3.10 or higher (Python 3.11 recommended) for the ML service
- **Package Managers**: `npm` (v9+) and `pip` / `venv` (or `uv`)

---

## 2. Project Layout

```text
SHMS/
├── src/
│   ├── app.js               # Express app configuration & middleware
│   ├── db/db.js             # Mongoose connection logic
│   ├── middleware/          # Auth, role-based authorization, error handlers
│   ├── models/              # Mongoose schemas & indexes
│   ├── controllers/         # Request handling & HTTP responses
│   ├── services/            # Business logic, state machine & wait prediction
│   └── routes/              # Express API route declarations
├── ml-service/              # Python FastAPI & ML wait-time prediction microservice
│   ├── app.py               # FastAPI server (GET /health, POST /predict)
│   ├── generate_data.py     # Reproducible synthetic OPD dataset generator
│   ├── train.py             # RandomForest model trainer & metrics evaluator
│   ├── data/                # Generated dataset CSV
│   ├── models/              # Serialized pipeline (.joblib) and metrics JSON
│   ├── tests/               # Pytest test suite
│   └── requirements.txt     # Python dependencies
├── frontend/                # React + Vite + Tailwind CSS client portal
├── scripts/
│   └── createAdmin.js       # First-time bootstrap script for admin account
├── server.js                # Server entry point, HTTP server & Socket.IO
├── .env.example             # Template for required environment variables
└── package.json             # Backend dependencies and scripts
```

---

## 3. Environment Configuration

1. In the project root, create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```
2. Configure the required parameters:
   - `PORT`: Port for the Express server (default: `5000`)
   - `CORS_ORIGIN`: Allowed frontend origin (e.g. `http://localhost:5173`)
   - `JWT_SECRET`: Secret key for JWT signing (must be at least 32 characters)
   - `MONGOURL`: MongoDB connection URI (e.g. `mongodb+srv://...` or `mongodb://localhost:27017/SHMS?replicaSet=rs0`)
   - `ML_SERVICE_URL`: Base URL for the Python ML prediction service (default: `http://localhost:8000`)
   - `DEFAULT_CONSULT_MIN`: Fallback consultation minutes per waiting patient (default: `8`)
   - `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_PHONE`: Initial administrator credentials for seeding

---

## 4. Installation & Startup (Running Together)

To run the complete system, start all three services in separate terminal windows:

### Terminal 1: Python ML Prediction Service
```bash
cd ml-service

# Create virtual environment and activate
python -m venv .venv
# On Windows PowerShell:
.venv\Scripts\Activate.ps1
# On Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the FastAPI microservice on port 8000
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```
*Health check:* Verify `GET http://localhost:8000/health` returns `status: "ok"`.

### Terminal 2: Node.js Backend API
```bash
# In the project root:
npm install

# Seed the first Administrator account (if not already seeded)
node scripts/createAdmin.js

# Start backend in development mode (runs on port 5000)
npm run dev
```

### Terminal 3: Frontend Client Portal
```bash
cd frontend
npm install

# Start Vite development server (runs on port 5173)
npm run dev
```

The frontend will run at `http://localhost:5173` and automatically proxy `/api` and `/socket.io` requests to `http://localhost:5000`.

---

## 5. User Roles & Capabilities

- **Patient**: Register online, book appointments, view status, access prescriptions and bills, use AI triage assistant.
- **Doctor**: View consultation schedule, manage clinical appointments, issue digital prescriptions.
- **Receptionist**: Check-in scheduled patients, handle walk-in queues, manage billings.
- **Administrator**: Manage hospital departments, staff/doctors, system users, pharmacy stock, and operational analytics.
