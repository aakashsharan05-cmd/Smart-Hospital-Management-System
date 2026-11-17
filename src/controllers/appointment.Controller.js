const Appointment = require("../models/appointment.model");
const Doctor = require("../models/doctor.model");
const mongoose = require("mongoose");

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

    // Check doctor availability on that day of week
    const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
    if (
      doctor.availableDays.length > 0 &&
      !doctor.availableDays.includes(dayName)
    ) {
      return res.status(400).json({
        success: false,
        message: `Doctor is not available on ${dayName}`,
      });
    }

    // Check for conflicting appointment (same doctor, same time slot)
    // We match within a 30-minute window to prevent overlapping slots
    const slotStart = new Date(date);
    const slotEnd = new Date(date.getTime() + 30 * 60 * 1000);

    const existingAppointment = await Appointment.findOne({
      doctor: doctor._id,
      appointmentDate: { $gte: slotStart, $lt: slotEnd },
      status: { $nin: ["cancelled", "rejected"] },
    });

    if (existingAppointment) {
      return res.status(409).json({
        success: false,
        message: "This time slot is already booked for this doctor",
      });
    }

    // Also check if the PATIENT already has an appointment at this time
    const patientConflict = await Appointment.findOne({
      patient: req.user.userId,
      appointmentDate: { $gte: slotStart, $lt: slotEnd },
      status: { $nin: ["cancelled", "rejected"] },
    });

    if (patientConflict) {
      return res.status(409).json({
        success: false,
        message: "You already have an appointment at this time",
      });
    }

    // Calculate queue number for this doctor on this date
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const appointmentsToday = await Appointment.countDocuments({
      doctor: doctor._id,
      appointmentDate: { $gte: dayStart, $lte: dayEnd },
      status: { $nin: ["cancelled", "rejected"] },
    });

    // Create appointment
    const appointment = await Appointment.create({
      patient: req.user.userId,
      doctor: doctor._id,
      department: doctor.department,
      appointmentDate: date,
      reason: reason.trim(),
      queueNumber: appointmentsToday + 1,
    });

    // Populate for response
    const populated = await Appointment.findById(appointment._id)
      .populate({
        path: "doctor",
        select: "specialization consultationFee userId",
        populate: { path: "userId", select: "name" },
      })
      .populate("department", "name");

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
      const dayStart = new Date(date);
      if (!isNaN(dayStart.getTime())) {
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);
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
      const dayStart = new Date(date);
      if (!isNaN(dayStart.getTime())) {
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);
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

    if (!["pending", "confirmed"].includes(appointment.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel an appointment with status '${appointment.status}'`,
      });
    }

    const { cancellationReason } = req.body;

    appointment.status = "cancelled";
    appointment.cancellationReason =
      cancellationReason?.trim() || "Cancelled by user";
    await appointment.save();

    return res.status(200).json({
      success: true,
      message: "Appointment cancelled successfully",
      appointment,
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
      const dayName = newDate.toLocaleDateString("en-US", { weekday: "long" });
      if (
        doctor.availableDays.length > 0 &&
        !doctor.availableDays.includes(dayName)
      ) {
        return res.status(400).json({
          success: false,
          message: `Doctor is not available on ${dayName}`,
        });
      }
    }

    // Check for conflicts at new time
    const slotStart = new Date(newDate);
    const slotEnd = new Date(newDate.getTime() + 30 * 60 * 1000);

    const conflict = await Appointment.findOne({
      _id: { $ne: appointment._id },
      doctor: appointment.doctor,
      appointmentDate: { $gte: slotStart, $lt: slotEnd },
      status: { $nin: ["cancelled", "rejected"] },
    });

    if (conflict) {
      return res.status(409).json({
        success: false,
        message: "The new time slot is already booked",
      });
    }

    appointment.appointmentDate = newDate;
    appointment.status = "pending"; // Reset to pending after reschedule
    await appointment.save();

    return res.status(200).json({
      success: true,
      message: "Appointment rescheduled successfully",
      appointment,
    });
  } catch (error) {
    console.error("Reschedule appointment error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ── Update appointment status (confirm/reject/complete) ───
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
    const validStatuses = ["confirmed", "rejected", "completed"];
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

    // Validate status transitions
    const allowedTransitions = {
      pending: ["confirmed", "rejected"],
      confirmed: ["completed", "rejected"],
    };

    const allowed = allowedTransitions[appointment.status];
    if (!allowed || !allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change status from '${appointment.status}' to '${status}'`,
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

    appointment.status = status;
    if (notes) {
      appointment.notes = notes.trim();
    }
    await appointment.save();

    return res.status(200).json({
      success: true,
      message: `Appointment ${status} successfully`,
      appointment,
    });
  } catch (error) {
    console.error("Update appointment status error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports = {
  bookAppointment,
  getMyAppointments,
  getDoctorAppointments,
  getAllAppointments,
  getAppointmentById,
  cancelAppointment,
  rescheduleAppointment,
  updateAppointmentStatus,
};