const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/auth.middleware");
const { authorizeRoles } = require("../middleware/role.middleware");

const {
  bookAppointment,
  createWalkInAppointment,
  getMyAppointments,
  getDoctorAppointments,
  getAllAppointments,
  getAppointmentById,
  checkInAppointment,
  startConsultation,
  endConsultation,
  cancelAppointment,
  rescheduleAppointment,
  updateAppointmentStatus,
} = require("../controllers/appointment.Controller");

// Patient books scheduled appointment
router.post("/", protect, authorizeRoles("patient"), bookAppointment);

// Receptionist / Admin registers walk-in patient & appointment
router.post(
  "/walk-in",
  protect,
  authorizeRoles("receptionist", "admin"),
  createWalkInAppointment
);

// Receptionist / Admin checks in a confirmed patient (confirmed -> in-queue)
router.patch(
  "/:id/check-in",
  protect,
  authorizeRoles("receptionist", "admin"),
  checkInAppointment
);

// Doctor starts consultation (in-queue -> in-consultation)
router.patch(
  "/:id/start-consultation",
  protect,
  authorizeRoles("doctor"),
  startConsultation
);

// Doctor ends consultation (in-consultation -> completed)
router.patch(
  "/:id/end-consultation",
  protect,
  authorizeRoles("doctor"),
  endConsultation
);

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