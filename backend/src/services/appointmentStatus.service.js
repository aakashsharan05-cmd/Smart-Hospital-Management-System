/**
 * Centralized Appointment Status & Lifecycle Service
 *
 * Enforces legal state machine transitions and post-commit Socket.IO event emissions.
 * Rules:
 *   - Events MUST only be emitted AFTER database mutations / transactions have successfully committed.
 *   - Failed or rolled-back transactions must NEVER emit socket events.
 */

const mongoose = require("mongoose");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const Appointment = require("../models/appointment.model");
const Doctor = require("../models/doctor.model");
const User = require("../models/user.model");
const { getNextQueueNumber } = require("../utils/counter");
const { getKolkataDateString } = require("../utils/timezone");
const { emitAppointmentStatusChanged, emitQueueUpdate } = require("./socket.service");
const { updateQueueWaitEstimates } = require("./waitPrediction.service");

const LEGAL_TRANSITIONS = {
  pending: ["confirmed", "rejected", "cancelled"],
  confirmed: ["in-queue", "missed", "cancelled"],
  "in-queue": ["in-consultation", "missed", "cancelled"],
  "in-consultation": ["completed"],
  completed: [],
  cancelled: [],
  rejected: [],
  missed: [],
};

/**
 * Validate whether a transition from currentStatus to targetStatus is allowed.
 *
 * @param {string} currentStatus
 * @param {string} targetStatus
 * @returns {{ allowed: boolean, message?: string }}
 */
const validateStatusTransition = (currentStatus, targetStatus) => {
  if (!LEGAL_TRANSITIONS[currentStatus]) {
    return {
      allowed: false,
      message: `Invalid current status '${currentStatus}'`,
    };
  }

  const allowedTargets = LEGAL_TRANSITIONS[currentStatus];
  if (!allowedTargets.includes(targetStatus)) {
    const validStr =
      allowedTargets.length > 0
        ? `Valid next states: ${allowedTargets.join(", ")}`
        : "This is a terminal state; no further transitions are allowed";

    return {
      allowed: false,
      message: `Cannot transition appointment from '${currentStatus}' to '${targetStatus}'. ${validStr}`,
    };
  }

  return { allowed: true };
};

/**
 * Populate standard appointment fields for responses and socket broadcasts.
 */
const populateAppointment = async (appointmentId, session = null) => {
  let query = Appointment.findById(appointmentId)
    .populate("patient", "name email phone")
    .populate({
      path: "doctor",
      select: "specialization consultationFee userId",
      populate: { path: "userId", select: "name email phone" },
    })
    .populate("department", "name");

  if (session) {
    query = query.session(session);
  }
  return await query;
};

/**
 * Service: Update status from pending -> confirmed | rejected
 */
const updateAppointmentStatusService = async ({ appointmentId, targetStatus, notes }) => {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    const err = new Error("Appointment not found");
    err.statusCode = 404;
    throw err;
  }

  const check = validateStatusTransition(appointment.status, targetStatus);
  if (!check.allowed) {
    const err = new Error(check.message);
    err.statusCode = 400;
    throw err;
  }

  appointment.status = targetStatus;
  if (notes) {
    appointment.notes = notes.trim();
  }
  await appointment.save();

  const populated = await populateAppointment(appointment._id);

  // Emit only AFTER DB write succeeds
  await emitAppointmentStatusChanged(populated);
  await emitQueueUpdate(appointment.doctor);

  return populated;
};

/**
 * Service: Check in a confirmed appointment -> in-queue
 */
const checkInAppointmentService = async (appointmentId) => {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    const err = new Error("Appointment not found");
    err.statusCode = 404;
    throw err;
  }

  const check = validateStatusTransition(appointment.status, "in-queue");
  if (!check.allowed) {
    const err = new Error(check.message);
    err.statusCode = 400;
    throw err;
  }

  // Check-in allowed only if appointmentDate is today in Asia/Kolkata
  const todayKolkata = getKolkataDateString(new Date());
  const apptDateKolkata = getKolkataDateString(appointment.appointmentDate);
  if (todayKolkata !== apptDateKolkata) {
    const err = new Error("Check-in is only allowed on the scheduled appointment date (Asia/Kolkata today)");
    err.statusCode = 400;
    throw err;
  }

  appointment.status = "in-queue";
  appointment.checkInTime = new Date();
  await appointment.save();

  await updateQueueWaitEstimates(appointment.doctor);
  const populated = await populateAppointment(appointment._id);

  // Emit only AFTER DB write succeeds
  await emitAppointmentStatusChanged(populated);
  await emitQueueUpdate(appointment.doctor);

  return populated;
};

/**
 * Service: Mark appointment as missed (confirmed|in-queue -> missed)
 */
const markMissedAppointmentService = async (appointmentId) => {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    const err = new Error("Appointment not found");
    err.statusCode = 404;
    throw err;
  }

  const check = validateStatusTransition(appointment.status, "missed");
  if (!check.allowed) {
    const err = new Error(check.message);
    err.statusCode = 400;
    throw err;
  }

  appointment.status = "missed";
  await appointment.save();

  await updateQueueWaitEstimates(appointment.doctor);
  const populated = await populateAppointment(appointment._id);

  // Emit only AFTER DB write succeeds
  await emitAppointmentStatusChanged(populated);
  await emitQueueUpdate(appointment.doctor);

  return populated;
};

/**
 * Service: Start doctor consultation -> in-consultation
 */
const startConsultationService = async ({ appointmentId, doctorProfileId }) => {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    const err = new Error("Appointment not found");
    err.statusCode = 404;
    throw err;
  }

  if (doctorProfileId && appointment.doctor.toString() !== doctorProfileId.toString()) {
    const err = new Error("You can only start consultations for your own appointments");
    err.statusCode = 403;
    throw err;
  }

  const check = validateStatusTransition(appointment.status, "in-consultation");
  if (!check.allowed) {
    const err = new Error(check.message);
    err.statusCode = 400;
    throw err;
  }

  appointment.status = "in-consultation";
  appointment.consultationStartTime = new Date();
  appointment.predictedWaitMinutes = 0;
  await appointment.save();

  await updateQueueWaitEstimates(appointment.doctor);
  const populated = await populateAppointment(appointment._id);

  // Emit only AFTER DB write succeeds
  await emitAppointmentStatusChanged(populated);
  await emitQueueUpdate(appointment.doctor);

  return populated;
};

/**
 * Service: End doctor consultation -> completed
 */
const endConsultationService = async ({ appointmentId, doctorProfileId, consultationNotes }) => {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    const err = new Error("Appointment not found");
    err.statusCode = 404;
    throw err;
  }

  if (doctorProfileId && appointment.doctor.toString() !== doctorProfileId.toString()) {
    const err = new Error("You can only complete consultations for your own appointments");
    err.statusCode = 403;
    throw err;
  }

  const check = validateStatusTransition(appointment.status, "completed");
  if (!check.allowed) {
    const err = new Error(check.message);
    err.statusCode = 400;
    throw err;
  }

  appointment.status = "completed";
  appointment.consultationEndTime = new Date();
  appointment.predictedWaitMinutes = 0;
  if (consultationNotes) {
    appointment.notes = consultationNotes.trim();
  }
  await appointment.save();

  await updateQueueWaitEstimates(appointment.doctor);
  const populated = await populateAppointment(appointment._id);

  // Emit only AFTER DB write succeeds
  await emitAppointmentStatusChanged(populated);
  await emitQueueUpdate(appointment.doctor);

  return populated;
};

/**
 * Service: Cancel appointment
 */
const cancelAppointmentService = async ({ appointmentId, cancellationReason }) => {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    const err = new Error("Appointment not found");
    err.statusCode = 404;
    throw err;
  }

  const check = validateStatusTransition(appointment.status, "cancelled");
  if (!check.allowed) {
    const err = new Error(check.message);
    err.statusCode = 400;
    throw err;
  }

  appointment.status = "cancelled";
  appointment.cancellationReason = cancellationReason?.trim() || "Cancelled by user";
  appointment.predictedWaitMinutes = 0;
  await appointment.save();

  await updateQueueWaitEstimates(appointment.doctor);
  const populated = await populateAppointment(appointment._id);

  // Emit only AFTER DB write succeeds
  await emitAppointmentStatusChanged(populated);
  await emitQueueUpdate(appointment.doctor);

  return populated;
};

/**
 * Service: Reschedule appointment
 */
const rescheduleAppointmentService = async ({ appointment, newSlotStart }) => {
  appointment.appointmentDate = newSlotStart;
  appointment.slotStart = newSlotStart;
  appointment.isSlotActive = true;
  appointment.status = "pending";
  await appointment.save();

  const populated = await populateAppointment(appointment._id);

  // Emit only AFTER DB write succeeds
  await emitAppointmentStatusChanged(populated);
  await emitQueueUpdate(appointment.doctor);

  return populated;
};

/**
 * Service: Register walk-in patient with MongoDB Transaction session
 * Emits Socket.IO events ONLY AFTER transaction has successfully committed.
 */
const createWalkInAppointmentService = async ({
  patientId,
  patient,
  doctorId,
  reason,
  slotStart,
  customSession = null,
}) => {
  const doctor = await Doctor.findById(doctorId);
  if (!doctor || !doctor.isAvailable) {
    const err = new Error("Doctor not found or currently unavailable");
    err.statusCode = 400;
    throw err;
  }

  const session = customSession || (await mongoose.startSession());
  let createdAppointmentId = null;

  const transactionWork = async (activeSession) => {
    let resolvedPatientId = null;

    if (patientId) {
      const existingUser = await User.findById(patientId).session(activeSession);
      if (!existingUser) {
        const err = new Error("Patient not found with provided ID");
        err.statusCode = 404;
        throw err;
      }
      resolvedPatientId = existingUser._id;
    } else if (patient && typeof patient === "object") {
      const { name, phone, email } = patient;
      if (!name || !name.trim()) {
        const err = new Error("Patient name is required");
        err.statusCode = 400;
        throw err;
      }
      if (!phone || !phone.trim()) {
        const err = new Error("Patient phone is required");
        err.statusCode = 400;
        throw err;
      }

      const trimmedPhone = phone.trim();
      const existingByPhone = await User.findOne({ phone: trimmedPhone }).session(activeSession);

      if (existingByPhone) {
        resolvedPatientId = existingByPhone._id;
      } else {
        let patientEmail = email?.trim().toLowerCase();
        if (!patientEmail) {
          const cleanPhone = trimmedPhone.replace(/[^0-9]/g, "");
          const randomSuffix = crypto.randomBytes(4).toString("hex");
          patientEmail = `walkin-${cleanPhone || "user"}-${randomSuffix}@hospital.local`;
        } else {
          const existingByEmail = await User.findOne({ email: patientEmail }).session(activeSession);
          if (existingByEmail) {
            const err = new Error("A user with this email already exists");
            err.statusCode = 409;
            throw err;
          }
        }

        const randomPassword = crypto.randomBytes(24).toString("hex");
        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        const [newUser] = await User.create(
          [
            {
              name: name.trim(),
              email: patientEmail,
              password: hashedPassword,
              phone: trimmedPhone,
              role: "patient",
              isActive: true,
            },
          ],
          { session: activeSession }
        );
        resolvedPatientId = newUser._id;
      }
    } else {
      const err = new Error("Either patientId or patient { name, phone } must be provided");
      err.statusCode = 400;
      throw err;
    }

    const now = new Date();
    const effectiveSlot = slotStart || now;

    // Atomic daily queue number
    const queueNumber = await getNextQueueNumber(doctor._id, effectiveSlot);

    const [newAppt] = await Appointment.create(
      [
        {
          patient: resolvedPatientId,
          doctor: doctor._id,
          department: doctor.department,
          appointmentDate: effectiveSlot,
          slotStart: effectiveSlot,
          appointmentType: "walk-in",
          status: "in-queue",
          checkInTime: now,
          isSlotActive: false,
          reason: reason.trim(),
          symptomText: reason.trim(),
          queueNumber,
        },
      ],
      { session: activeSession }
    );

    createdAppointmentId = newAppt._id;
  };

  try {
    if (customSession) {
      // Caller manages session lifecycle
      await transactionWork(customSession);
    } else {
      await session.withTransaction(async () => {
        await transactionWork(session);
      });
    }
  } finally {
    if (!customSession) {
      await session.endSession();
    }
  }

  // Update dynamic wait estimates for all queue appointments of this doctor
  await updateQueueWaitEstimates(doctor._id);

  // Populate AFTER transaction commit has succeeded
  const populated = await populateAppointment(createdAppointmentId);

  // Emit events strictly AFTER successful commit
  await emitAppointmentStatusChanged(populated);
  await emitQueueUpdate(doctor._id);

  return populated;
};

/**
 * Service: Book scheduled appointment
 */
const bookAppointmentService = async (appointmentDoc) => {
  const populated = await populateAppointment(appointmentDoc._id);
  await emitAppointmentStatusChanged(populated);
  return populated;
};

module.exports = {
  LEGAL_TRANSITIONS,
  validateStatusTransition,
  updateAppointmentStatusService,
  checkInAppointmentService,
  markMissedAppointmentService,
  startConsultationService,
  endConsultationService,
  cancelAppointmentService,
  rescheduleAppointmentService,
  createWalkInAppointmentService,
  bookAppointmentService,
  populateAppointment,
};
