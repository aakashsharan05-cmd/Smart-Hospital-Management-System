const Appointment = require("../models/appointment.model");
const Doctor = require("../models/doctor.model");
const User = require("../models/user.model");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const {
  getKolkataWeekday,
  getKolkataTimeString,
  getKolkataDayRange,
  isTimeWithinRange,
} = require("../utils/timezone");
const { getNextQueueNumber } = require("../utils/counter");
const {
  validateStatusTransition,
  updateAppointmentStatusService,
  checkInAppointmentService,
  startConsultationService,
  endConsultationService,
  cancelAppointmentService,
  rescheduleAppointmentService,
  createWalkInAppointmentService,
  bookAppointmentService,
} = require("../services/appointmentStatus.service");

// Normalize a Date to its 30-minute slot start (e.g. 10:15 -> 10:00:00.000, 10:45 -> 10:30:00.000)
const normalizeSlotStart = (date) => {
  const normalized = new Date(date);
  const minutes = normalized.getMinutes();
  normalized.setMinutes(minutes < 30 ? 0 : 30, 0, 0);
  return normalized;
};

// ── Patient books an appointment ──────────────────────────
const bookAppointment = async (req, res) => {
  try {
    const { doctorId, appointmentDate, reason } = req.body;

    // Validate required fields
    if (
      !doctorId ||
      !appointmentDate ||
      typeof reason !== "string" ||
      !reason.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "doctorId, appointmentDate and reason are required",
      });
    }

    if (!mongoose.isValidObjectId(doctorId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid doctor ID",
      });
    }

    // Validate doctor exists and is available
    const doctor = await Doctor.findById(doctorId);
    if (!doctor || !doctor.isAvailable) {
      return res.status(400).json({
        success: false,
        message: "Doctor not found or currently unavailable",
      });
    }

    // Validate date
    const date = new Date(appointmentDate);
    if (isNaN(date.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment date",
      });
    }

    if (date <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Appointment date must be in the future",
      });
    }

    // Normalize appointmentDate and slotStart to the 30-minute slot boundary
    const slotStart = normalizeSlotStart(date);

    // Check doctor availability on that day of week in Asia/Kolkata
    const dayName = getKolkataWeekday(slotStart);
    if (
      doctor.availableDays &&
      doctor.availableDays.length > 0 &&
      !doctor.availableDays.includes(dayName)
    ) {
      return res.status(400).json({
        success: false,
        message: `Doctor is not available on ${dayName}`,
      });
    }

    // Enforce doctor.availableTime start/end in Asia/Kolkata
    const slotTimeStr = getKolkataTimeString(slotStart);
    const doctorStartTime = doctor.availableTime?.start || "09:00";
    const doctorEndTime = doctor.availableTime?.end || "17:00";
    if (!isTimeWithinRange(slotTimeStr, doctorStartTime, doctorEndTime)) {
      return res.status(400).json({
        success: false,
        message: `Doctor is only available between ${doctorStartTime} and ${doctorEndTime} IST. Selected slot time: ${slotTimeStr}`,
      });
    }

    const existingAppointment = await Appointment.findOne({
      doctor: doctor._id,
      slotStart,
      status: { $nin: ["cancelled", "rejected"] },
    });

    if (existingAppointment) {
      return res.status(409).json({
        success: false,
        message: "This time slot is already booked for this doctor",
      });
    }

    // Also check if the PATIENT already has an appointment at this slot
    const patientConflict = await Appointment.findOne({
      patient: req.user.userId,
      slotStart,
      status: { $nin: ["cancelled", "rejected"] },
    });

    if (patientConflict) {
      return res.status(409).json({
        success: false,
        message: "You already have an appointment at this time",
      });
    }

    // Assign atomic queue number per doctor per day (Asia/Kolkata date)
    const queueNumber = await getNextQueueNumber(doctor._id, slotStart);

    // Create appointment with normalized slot
    const appointment = await Appointment.create({
      patient: req.user.userId,
      doctor: doctor._id,
      department: doctor.department,
      appointmentDate: slotStart,
      slotStart,
      isSlotActive: true,
      reason: reason.trim(),
      queueNumber,
    });

    // Delegate to service for population and status changed emission
    const populated = await bookAppointmentService(appointment);

    return res.status(201).json({
      success: true,
      message: "Appointment booked successfully",
      appointment: populated,
    });
  } catch (error) {
    // Handle race condition: unique index violation
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This time slot was just booked. Please choose another.",
      });
    }

    console.error("Book appointment error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ── Patient views their own appointments ──────────────────
const getMyAppointments = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { patient: req.user.userId };

    if (status && ["pending", "confirmed", "cancelled", "completed", "rejected"].includes(status)) {
      filter.status = status;
    }

    const appointments = await Appointment.find(filter)
      .populate({
        path: "doctor",
        select: "specialization consultationFee userId",
        populate: { path: "userId", select: "name email phone" },
      })
      .populate("department", "name")
      .sort({ appointmentDate: -1 });

    return res.status(200).json({
      success: true,
      message: "Appointments fetched successfully",
      appointments,
    });
  } catch (error) {
    console.error("Get my appointments error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ── Doctor views their appointments ───────────────────────
const getDoctorAppointments = async (req, res) => {
  try {
    // Find doctor profile for logged-in user
    const doctor = await Doctor.findOne({ userId: req.user.userId });
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor profile not found",
      });
    }

    const { status, date } = req.query;
    const filter = { doctor: doctor._id };

    if (status && ["pending", "confirmed", "cancelled", "completed", "rejected"].includes(status)) {
      filter.status = status;
    }

    if (date) {
      const { start: dayStart, end: dayEnd } = getKolkataDayRange(date);
      if (!isNaN(dayStart.getTime())) {
        filter.appointmentDate = { $gte: dayStart, $lte: dayEnd };
      }
    }

    const appointments = await Appointment.find(filter)
      .populate("patient", "name email phone")
      .populate("department", "name")
      .sort({ appointmentDate: 1 });

    return res.status(200).json({
      success: true,
      message: "Appointments fetched successfully",
      appointments,
    });
  } catch (error) {
    console.error("Get doctor appointments error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ── Admin/Receptionist views all appointments ─────────────
const getAllAppointments = async (req, res) => {
  try {
    const { status, date, doctorId } = req.query;
    const filter = {};

    if (status && ["pending", "confirmed", "cancelled", "completed", "rejected"].includes(status)) {
      filter.status = status;
    }

    if (date) {
      const { start: dayStart, end: dayEnd } = getKolkataDayRange(date);
      if (!isNaN(dayStart.getTime())) {
        filter.appointmentDate = { $gte: dayStart, $lte: dayEnd };
      }
    }

    if (doctorId && mongoose.isValidObjectId(doctorId)) {
      filter.doctor = doctorId;
    }

    const appointments = await Appointment.find(filter)
      .populate("patient", "name email phone")
      .populate({
        path: "doctor",
        select: "specialization userId",
        populate: { path: "userId", select: "name" },
      })
      .populate("department", "name")
      .sort({ appointmentDate: -1 });

    return res.status(200).json({
      success: true,
      message: "Appointments fetched successfully",
      appointments,
    });
  } catch (error) {
    console.error("Get all appointments error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ── Get single appointment by ID ──────────────────────────
const getAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment ID",
      });
    }

    const appointment = await Appointment.findById(id)
      .populate("patient", "name email phone")
      .populate({
        path: "doctor",
        select: "specialization consultationFee userId",
        populate: { path: "userId", select: "name email phone" },
      })
      .populate("department", "name");

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // Access control: patient can only see own, doctor can see own
    const { userId, role } = req.user;
    if (role === "patient" && appointment.patient._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this appointment",
      });
    }

    if (role === "doctor") {
      const doctor = await Doctor.findOne({ userId });
      if (!doctor || appointment.doctor._id.toString() !== doctor._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to view this appointment",
        });
      }
    }

    return res.status(200).json({
      success: true,
      appointment,
    });
  } catch (error) {
    console.error("Get appointment error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ── Cancel appointment ────────────────────────────────────
const cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment ID",
      });
    }

    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // Only the patient who booked, or admin/receptionist can cancel
    const { userId, role } = req.user;
    if (
      role === "patient" &&
      appointment.patient.toString() !== userId
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only cancel your own appointments",
      });
    }

    if (!["pending", "confirmed", "in-queue"].includes(appointment.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel an appointment with status '${appointment.status}'`,
      });
    }

    const { cancellationReason } = req.body;
    const updated = await cancelAppointmentService({
      appointmentId: id,
      cancellationReason,
    });

    return res.status(200).json({
      success: true,
      message: "Appointment cancelled successfully",
      appointment: updated,
    });
  } catch (error) {
    console.error("Cancel appointment error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ── Reschedule appointment ────────────────────────────────
const rescheduleAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment ID",
      });
    }

    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // Only patient (own) or admin/receptionist can reschedule
    const { userId, role } = req.user;
    if (
      role === "patient" &&
      appointment.patient.toString() !== userId
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only reschedule your own appointments",
      });
    }

    if (!["pending", "confirmed"].includes(appointment.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot reschedule an appointment with status '${appointment.status}'`,
      });
    }

    const { appointmentDate } = req.body;
    if (!appointmentDate) {
      return res.status(400).json({
        success: false,
        message: "New appointment date is required",
      });
    }

    const newDate = new Date(appointmentDate);
    if (isNaN(newDate.getTime()) || newDate <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "New appointment date must be a valid future date",
      });
    }

    // Check availability for the doctor on the new date
    const doctor = await Doctor.findById(appointment.doctor);
    if (doctor) {
      const dayName = getKolkataWeekday(newSlotStart);
      if (
        doctor.availableDays &&
        doctor.availableDays.length > 0 &&
        !doctor.availableDays.includes(dayName)
      ) {
        return res.status(400).json({
          success: false,
          message: `Doctor is not available on ${dayName}`,
        });
      }

      // Enforce doctor.availableTime start/end in Asia/Kolkata
      const slotTimeStr = getKolkataTimeString(newSlotStart);
      const doctorStartTime = doctor.availableTime?.start || "09:00";
      const doctorEndTime = doctor.availableTime?.end || "17:00";
      if (!isTimeWithinRange(slotTimeStr, doctorStartTime, doctorEndTime)) {
        return res.status(400).json({
          success: false,
          message: `Doctor is only available between ${doctorStartTime} and ${doctorEndTime} IST. Selected slot time: ${slotTimeStr}`,
        });
      }
    }

    // Check for conflicts at new 30-min normalized slot
    const newSlotStart = normalizeSlotStart(newDate);

    const conflict = await Appointment.findOne({
      _id: { $ne: appointment._id },
      doctor: appointment.doctor,
      slotStart: newSlotStart,
      status: { $nin: ["cancelled", "rejected"] },
    });

    if (conflict) {
      return res.status(409).json({
        success: false,
        message: "The new time slot is already booked",
      });
    }

    const updated = await rescheduleAppointmentService({
      appointment,
      newSlotStart,
    });

    return res.status(200).json({
      success: true,
      message: "Appointment rescheduled successfully",
      appointment: updated,
    });
  } catch (error) {
    console.error("Reschedule appointment error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ── Update appointment status (pending -> confirmed | rejected only) ─
const updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment ID",
      });
    }

    const { status, notes } = req.body;
    if (status === "completed") {
      return res.status(400).json({
        success: false,
        message:
          "Completion is only permitted via doctor consultation completion (/api/appointments/:id/end-consultation)",
      });
    }

    const validStatuses = ["confirmed", "rejected"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // Validate state transition using the centralized transition engine
    const check = validateStatusTransition(appointment.status, status);
    if (!check.allowed) {
      return res.status(400).json({
        success: false,
        message: check.message,
      });
    }

    // If doctor is updating, verify it's their appointment
    if (req.user.role === "doctor") {
      const doctor = await Doctor.findOne({ userId: req.user.userId });
      if (!doctor || appointment.doctor.toString() !== doctor._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "You can only update your own appointments",
        });
      }
    }

    const updated = await updateAppointmentStatusService({
      appointmentId: id,
      targetStatus: status,
      notes,
    });

    return res.status(200).json({
      success: true,
      message: `Appointment ${status} successfully`,
      appointment: updated,
    });
  } catch (error) {
    console.error("Update appointment status error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ── Walk-in appointment registration (Receptionist/Admin) ─
const createWalkInAppointment = async (req, res) => {
  try {
    const { patientId, patient, doctorId, reason } = req.body;

    if (!doctorId || !mongoose.isValidObjectId(doctorId)) {
      return res.status(400).json({
        success: false,
        message: "Valid doctorId is required",
      });
    }

    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Reason is required for walk-in appointment",
      });
    }

    const now = new Date();
    const slotStart = normalizeSlotStart(now);

    const populated = await createWalkInAppointmentService({
      patientId,
      patient,
      doctorId,
      reason,
      slotStart,
    });

    return res.status(201).json({
      success: true,
      message: "Walk-in appointment registered successfully and placed in queue",
      appointment: populated,
    });
  } catch (error) {
    console.error("Create walk-in error:", error.message);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to create walk-in appointment",
    });
  }
};

// ── Check in scheduled appointment (Receptionist/Admin) ───
const checkInAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment ID",
      });
    }

    const populated = await checkInAppointmentService(id);

    return res.status(200).json({
      success: true,
      message: "Patient checked in successfully; status updated to in-queue",
      appointment: populated,
    });
  } catch (error) {
    console.error("Check-in error:", error.message);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Server error during check-in",
    });
  }
};

// ── Doctor starts consultation (Doctor only) ──────────────
const startConsultation = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment ID",
      });
    }

    const doctor = await Doctor.findOne({ userId: req.user.userId });
    if (!doctor) {
      return res.status(403).json({
        success: false,
        message: "Doctor profile not found",
      });
    }

    const populated = await startConsultationService({
      appointmentId: id,
      doctorProfileId: doctor._id,
    });

    return res.status(200).json({
      success: true,
      message: "Consultation started successfully",
      appointment: populated,
    });
  } catch (error) {
    console.error("Start consultation error:", error.message);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Server error during starting consultation",
    });
  }
};

// ── Doctor ends consultation (Doctor only) ────────────────
const endConsultation = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment ID",
      });
    }

    const doctor = await Doctor.findOne({ userId: req.user.userId });
    if (!doctor) {
      return res.status(403).json({
        success: false,
        message: "Doctor profile not found",
      });
    }

    const { consultationNotes } = req.body;
    const populated = await endConsultationService({
      appointmentId: id,
      doctorProfileId: doctor._id,
      consultationNotes,
    });

    return res.status(200).json({
      success: true,
      message: "Consultation completed successfully",
      appointment: populated,
    });
  } catch (error) {
    console.error("End consultation error:", error.message);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Server error during completing consultation",
    });
  }
};

// ── Get appointment wait time estimate ────────────────────
const getAppointmentWaitEstimate = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment ID",
      });
    }

    const appointment = await Appointment.findById(id).populate("doctor", "userId");
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
        message: "You can only view wait estimates for your own appointments",
      });
    }

    if (role === "doctor") {
      const doctor = await Doctor.findOne({ userId });
      if (!doctor || appointment.doctor?._id.toString() !== doctor._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "You can only view wait estimates for your own patients",
        });
      }
    }

    let queuePosition = 0;
    if (appointment.status === "in-queue") {
      const doctorId = appointment.doctor._id || appointment.doctor;
      const todayRange = getKolkataDayRange(appointment.appointmentDate || new Date());

      // Count appointments currently with the same doctor on the same Kolkata calendar day
      const inConsultCount = await Appointment.countDocuments({
        doctor: doctorId,
        status: "in-consultation",
        appointmentDate: { $gte: todayRange.start, $lte: todayRange.end },
      });

      // Count appointments ahead in queue for the same doctor and same Kolkata day
      const aheadFilter = {
        doctor: doctorId,
        status: "in-queue",
        appointmentDate: { $gte: todayRange.start, $lte: todayRange.end },
      };

      if (appointment.queueNumber) {
        aheadFilter.queueNumber = { $lt: appointment.queueNumber };
      } else if (appointment.checkInTime) {
        aheadFilter.checkInTime = { $lt: appointment.checkInTime };
      }

      const aheadCount = await Appointment.countDocuments(aheadFilter);
      queuePosition = inConsultCount + aheadCount + 1;
    } else if (appointment.status === "in-consultation") {
      queuePosition = 1;
    }

    return res.status(200).json({
      success: true,
      appointmentId: appointment._id,
      status: appointment.status,
      queueNumber: appointment.queueNumber || null,
      queuePosition,
      predictedWaitMinutes: appointment.predictedWaitMinutes || 0,
      typicalErrorMinutes:
        appointment.typicalErrorMinutes ??
        (appointment.waitPredictionSource === "ml-model" ? 2.4 : 5.0),
      waitPredictionSource: appointment.waitPredictionSource || "fallback-formula",
    });
  } catch (error) {
    console.error("Get wait estimate error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports = {
  bookAppointment,
  createWalkInAppointment,
  getMyAppointments,
  getDoctorAppointments,
  getAllAppointments,
  getAppointmentById,
  getAppointmentWaitEstimate,
  checkInAppointment,
  startConsultation,
  endConsultation,
  cancelAppointment,
  rescheduleAppointment,
  updateAppointmentStatus,
};