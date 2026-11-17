const express = require("express");

const { protect } = require("../middleware/auth.middleware");
const { authorizeRoles } = require("../middleware/role.middleware");
const {
  createDoctor,
  getDoctors,
  getDoctorsById,
  updateDoctor,
} = require("../controllers/doctor.Controller");

const router = express.Router();

// Admin creates doctor account + profile in one call
router.post("/", protect, authorizeRoles("admin"), createDoctor);

// Any authenticated user can list / search doctors
router.get("/", protect, getDoctors);

// Any authenticated user can view a single doctor
router.get("/:id", protect, getDoctorsById);

// Admin (or the doctor themselves) can update profile
router.patch("/:id", protect, authorizeRoles("admin", "doctor"), updateDoctor);

module.exports = router;