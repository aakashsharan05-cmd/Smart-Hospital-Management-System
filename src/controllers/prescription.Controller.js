const Prescription = require("../models/prescription.model");
const Appointment = require("../models/appointment.model");
const Doctor = require("../models/doctor.model");
const mongoose = require("mongoose");

// ── Doctor creates a prescription for a completed/confirmed appointment ──
const createPrescription = async (req, res) => {
  try {
    const { appointmentId, diagnosis, medicines, advice, followUpDate } =
      req.body;

    if (!appointmentId || !diagnosis?.trim()) {
      return res.status(400).json({
        success: false,
        message: "appointmentId and diagnosis are required",
      });
    }

    if (!mongoose.isValidObjectId(appointmentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment ID",
      });
    }

    // Validate medicines array
    if (!Array.isArray(medicines) || medicines.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one medicine is required",
      });
    }

    for (const med of medicines) {
      if (!med.name?.trim() || !med.dosage?.trim() || !med.frequency?.trim() || !med.duration?.trim()) {
        return res.status(400).json({
          success: false,
          message: "Each medicine must have name, dosage, frequency, and duration",
        });
      }
    }

    // Verify appointment exists and belongs to this doctor
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // Verify the logged-in doctor owns this appointment
    const doctor = await Doctor.findOne({ userId: req.user.userId });
    if (!doctor || appointment.doctor.toString() !== doctor._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only create prescriptions for your own appointments",
      });
    }

    if (!["in-consultation", "completed"].includes(appointment.status)) {
      return res.status(400).json({
        success: false,
        message:
          "Prescription can only be created for appointments in-consultation or completed",
      });
    }

    // Validate followUpDate if provided
    let parsedFollowUp = null;
    if (followUpDate) {
      parsedFollowUp = new Date(followUpDate);
      if (isNaN(parsedFollowUp.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid follow-up date",
        });
      }
    }

    const prescription = await Prescription.create({
      appointment: appointmentId,
      patient: appointment.patient,
      doctor: doctor._id,
      diagnosis: diagnosis.trim(),
      medicines,
      advice: advice?.trim() || "",
      followUpDate: parsedFollowUp,
    });

    const populated = await Prescription.findById(prescription._id)
      .populate("patient", "name email")
      .populate({
        path: "doctor",
        select: "specialization userId",
        populate: { path: "userId", select: "name" },
      })
      .populate("appointment", "appointmentDate reason");

    return res.status(201).json({
      success: true,
      message: "Prescription created successfully",
      prescription: populated,
    });
  } catch (error) {
    console.error("Create prescription error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ── Get prescriptions for a specific appointment ──────────
const getPrescriptionsByAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    if (!mongoose.isValidObjectId(appointmentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment ID",
      });
    }

    // Access control: patient can see own, doctor can see own
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    const { userId, role } = req.user;
    if (role === "patient" && appointment.patient.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    if (role === "doctor") {
      const doctor = await Doctor.findOne({ userId });
      if (!doctor || appointment.doctor.toString() !== doctor._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Not authorized",
        });
      }
    }

    const prescriptions = await Prescription.find({
      appointment: appointmentId,
    })
      .populate("patient", "name email")
      .populate({
        path: "doctor",
        select: "specialization userId",
        populate: { path: "userId", select: "name" },
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      prescriptions,
    });
  } catch (error) {
    console.error("Get prescriptions by appointment error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ── Patient views all their prescriptions ─────────────────
const getMyPrescriptions = async (req, res) => {
  try {
    const prescriptions = await Prescription.find({
      patient: req.user.userId,
    })
      .populate({
        path: "doctor",
        select: "specialization userId",
        populate: { path: "userId", select: "name" },
      })
      .populate("appointment", "appointmentDate reason")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      prescriptions,
    });
  } catch (error) {
    console.error("Get my prescriptions error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ── Get single prescription by ID ─────────────────────────
const getPrescriptionById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid prescription ID",
      });
    }

    const prescription = await Prescription.findById(id)
      .populate("patient", "name email phone")
      .populate({
        path: "doctor",
        select: "specialization qualification userId",
        populate: { path: "userId", select: "name" },
      })
      .populate("appointment", "appointmentDate reason");

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: "Prescription not found",
      });
    }

    // Access control
    const { userId, role } = req.user;
    if (role === "patient" && prescription.patient._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    if (role === "doctor") {
      const doctor = await Doctor.findOne({ userId });
      if (
        !doctor ||
        prescription.doctor._id.toString() !== doctor._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "Not authorized",
        });
      }
    }

    return res.status(200).json({
      success: true,
      prescription,
    });
  } catch (error) {
    console.error("Get prescription error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports = {
  createPrescription,
  getPrescriptionsByAppointment,
  getMyPrescriptions,
  getPrescriptionById,
};
