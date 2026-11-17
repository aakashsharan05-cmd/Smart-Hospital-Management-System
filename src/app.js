const express = require("express");
const cors = require("cors");

const app = express();

// ── Core Middleware ───────────────────────────────────────
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json({ limit: "10kb" })); // limit body size

// ── Route Imports ─────────────────────────────────────────
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const departmentRoutes = require("./routes/department.routes");
const doctorRoutes = require("./routes/doctor.routes");
const appointmentRoutes = require("./routes/appointment.routes");
const prescriptionRoutes = require("./routes/prescription.routes");
const billingRoutes = require("./routes/billing.routes");
const pharmacyRoutes = require("./routes/pharmacy.routes");

// ── API Routes ────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/pharmacy", pharmacyRoutes);

// ── Health Check ──────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.status(200).json({ success: true, message: "Server is running" });
});

// ── Centralized Error Handler (must be last) ──────────────
const errorHandler = require("./middleware/errorHandler");
app.use(errorHandler);

module.exports = app;
