const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/auth.middleware");
const { authorizeRoles } = require("../middleware/role.middleware");

const {
  createPrescription,
  getPrescriptionsByAppointment,
  getMyPrescriptions,
  getPrescriptionById,
} = require("../controllers/prescription.Controller");

// Doctor creates prescription
router.post("/", protect, authorizeRoles("doctor"), createPrescription);

// Patient views own prescriptions
router.get("/my", protect, authorizeRoles("patient"), getMyPrescriptions);

// Get prescriptions for a specific appointment
router.get(
  "/appointment/:appointmentId",
  protect,
  getPrescriptionsByAppointment
);

// Get single prescription
router.get("/:id", protect, getPrescriptionById);

module.exports = router;
