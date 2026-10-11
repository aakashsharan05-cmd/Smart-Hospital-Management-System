
const express = require("express");
const cors = require("cors");

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
const { protect } = require("./middleware/auth.middleware");
const { authorizeRoles } = require("./middleware/role.middleware");

const authRoutes = require("./routes/auth.routes");
const departmentRoutes = require("./routes/department.routes");
const doctorRoutes = require("./routes/doctor.routes");

app.use("/api/auth", authRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/doctors", doctorRoutes);

// Protected route: logged-in user only
app.get("/api/auth/me", protect, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Authenticated user",
    user: req.user,
  });
});

// Admin-only route
app.get(
  "/api/admin/dashboard",
  protect,
  authorizeRoles("admin"),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: "Welcome to Admin Dashboard",
    });
  }
);


module.exports = app;
