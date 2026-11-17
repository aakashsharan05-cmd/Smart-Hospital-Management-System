# Smart Hospital Management System (SHMS)

A full-stack Hospital Management System built on the MERN stack (MongoDB, Express, React, Node.js) with role-based access control, real-time queues, prescription and billing workflows, and AI-assisted triage and waiting-time estimation.

---

## 1. Prerequisites

- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **MongoDB**: MongoDB Atlas cluster or local MongoDB instance (Replica Set required for transactions)
- **Package Manager**: `npm` (v9+)

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
│   └── routes/              # Express API route declarations
├── frontend/                # React + Vite + Tailwind CSS client portal
├── scripts/
│   └── createAdmin.js       # First-time bootstrap script for admin account
├── server.js                # Server entry point & environment validation
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
   - `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_PHONE`: Initial administrator credentials for seeding

---

## 4. Installation & Startup

### Step 1: Backend Installation & Setup

```bash
# Install backend dependencies
npm install

# Seed the first Administrator account
node scripts/createAdmin.js

# Start backend in development mode
npm run dev

# Or start in production mode
npm start
```

### Step 2: Frontend Installation & Setup

```bash
cd frontend

# Install frontend dependencies
npm install

# Start Vite development server
npm run dev
```

The frontend will run at `http://localhost:5173` and automatically proxy `/api` requests to `http://localhost:5000`.

---

## 5. User Roles & Capabilities

- **Patient**: Register online, book appointments, view status, access prescriptions and bills, use AI triage assistant.
- **Doctor**: View consultation schedule, manage clinical appointments, issue digital prescriptions.
- **Receptionist**: Check-in scheduled patients, handle walk-in queues, manage billings.
- **Administrator**: Manage hospital departments, staff/doctors, system users, pharmacy stock, and operational analytics.
