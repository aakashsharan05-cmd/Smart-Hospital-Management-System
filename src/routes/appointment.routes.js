const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/auth.middleware");
const { authorizeRoles } = require("../middleware/role.middleware");

const {
  bookAppointment,
  getMyAppointments,
  getDoctorAppointments,
  getAllAppointments,
  getAppointmentById,
  cancelAppointment,
  rescheduleAppointment,
  updateAppointmentStatus,
} = require("../controllers/appointment.Controller");

// Patient books appointment
router.post("/", protect, authorizeRoles("patient"), bookAppointment);

// Patient views own appointments
router.get("/my", protect, authorizeRoles("patient"), getMyAppointments);

// Doctor views their appointments
router.get(
  "/doctor",
  protect,
  authorizeRoles("doctor"),
  getDoctorAppointments
);

// Admin / Receptionist views all appointments
router.get(
  "/",
  protect,
  authorizeRoles("admin", "receptionist"),
  getAllAppointments
);

// Any authenticated user can view a single appointment (access-controlled inside)
router.get("/:id", protect, getAppointmentById);

// Cancel (patient own, admin, receptionist)
router.patch(
  "/:id/cancel",
  protect,
  authorizeRoles("patient", "admin", "receptionist"),
  cancelAppointment
);

// Reschedule (patient own, admin, receptionist)
router.patch(
  "/:id/reschedule",
  protect,
  authorizeRoles("patient", "admin", "receptionist"),
  rescheduleAppointment
);

// Update status — confirm / reject / complete (doctor, admin, receptionist)
router.patch(
  "/:id/status",
  protect,
  authorizeRoles("doctor", "admin", "receptionist"),
  updateAppointmentStatus
);

module.exports = router;