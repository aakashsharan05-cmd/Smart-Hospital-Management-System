/**
 * Wait-Time Prediction Service
 *
 * Integrates with the FastAPI ML service (POST /predict with 1.5s timeout)
 * and provides a robust heuristic fallback:
 *   predictedWait = 5 + queueLength * Number(DEFAULT_CONSULT_MIN || 8)
 *
 * Stores waitPredictionSource ("ml-model" | "fallback-formula") and
 * predictedWaitMinutes on the appointment.
 */

const path = require("path");
const fs = require("fs");
const Appointment = require("../models/appointment.model");
const Doctor = require("../models/doctor.model");
const {
  toModelDayOfWeek,
  getKolkataHour,
  getKolkataDayRange,
} = require("../utils/timezone");
const { sortAppointmentsByQueueOrder } = require("../utils/queueOrder");

// Load heuristic baseline MAE from metrics.json if available (about 12 min)
let heuristicTypicalError = null;
try {
  const metricsPath = path.resolve(__dirname, "../../../ml/models/metrics.json");
  if (fs.existsSync(metricsPath)) {
    const raw = JSON.parse(fs.readFileSync(metricsPath, "utf-8"));
    const hMae = raw?.metrics?.heuristic_formula?.mae;
    if (hMae !== undefined && !isNaN(Number(hMae))) {
      heuristicTypicalError = Math.round(Number(hMae) * 10) / 10;
    }
  }
} catch {
  heuristicTypicalError = null;
}

/**
 * Predict wait time for a given queue length using ML service with 1.5s timeout,
 * falling back to formula on timeout/error.
 *
 * @param {Object} params
 * @param {number} params.queueLength
 * @param {Date} [params.date]
 * @param {string} [params.departmentName]
 * @param {number} [params.doctorExperience]
 * @returns {Promise<{ predictedWaitMinutes: number, waitPredictionSource: "ml-model" | "fallback-formula" }>}
 */
const computeWaitTime = async ({
  queueLength = 0,
  date = new Date(),
  departmentName = "",
  doctorExperience = 5,
}) => {
  const safeQueueLength = Math.max(0, queueLength);
  const defaultConsultMin = Number(process.env.DEFAULT_CONSULT_MIN || 8);
  const fallbackWait = 5 + safeQueueLength * defaultConsultMin;

  const mlServiceUrl = (process.env.ML_SERVICE_URL || "http://localhost:8000").replace(/\/$/, "");
  const endpoint = `${mlServiceUrl}/predict`;

  const dayOfWeek = toModelDayOfWeek(date);
  const hour = getKolkataHour(date);

  const payload = {
    queue_length: safeQueueLength,
    day_of_week: dayOfWeek,
    hour,
    department: departmentName,
    doctor_experience: doctorExperience,
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Connection: "close",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const rawPrediction =
        data.predicted_wait_minutes ??
        data.predictedWaitMinutes ??
        data.prediction ??
        data.wait_time;

      if (rawPrediction !== undefined && !isNaN(Number(rawPrediction))) {
        const rawTypicalError =
          data.typical_error_minutes ??
          data.typicalErrorMinutes ??
          data.mae;
        const typicalErrorMinutes =
          rawTypicalError !== undefined && rawTypicalError !== null && !isNaN(Number(rawTypicalError))
            ? Math.round(Number(rawTypicalError) * 10) / 10
            : null;

        return {
          predictedWaitMinutes: Math.max(0, Math.round(Number(rawPrediction))),
          typicalErrorMinutes,
          waitPredictionSource: "ml-model",
        };
      }
    }
  } catch (err) {
    // Expected fallback when ML service is offline or timeout fires (> 1500ms)
    // Silently fall back to heuristic formula
  }

  return {
    predictedWaitMinutes: Math.round(fallbackWait),
    typicalErrorMinutes: heuristicTypicalError,
    waitPredictionSource: "fallback-formula",
  };
};

/**
 * Recompute wait times for all currently waiting (in-queue) appointments of a doctor,
 * updating the DB documents directly.
 *
 * @param {string|mongoose.Types.ObjectId} doctorId
 * @returns {Promise<Array<Appointment>>}
 */
const updateQueueWaitEstimates = async (doctorId) => {
  if (!doctorId) return [];

  const doctorIdStr = doctorId._id ? doctorId._id.toString() : doctorId.toString();
  const todayRange = getKolkataDayRange(new Date());

  const doctor = await Doctor.findById(doctorIdStr).populate("department", "name");
  const departmentName = doctor?.department?.name || "";
  const doctorExperience = doctor?.experience || 5;

  // Check if someone is currently in consultation
  const inConsultCount = await Appointment.countDocuments({
    doctor: doctorIdStr,
    status: "in-consultation",
    appointmentDate: { $gte: todayRange.start, $lte: todayRange.end },
  });

  const rawWaiting = await Appointment.find({
    doctor: doctorIdStr,
    status: "in-queue",
    appointmentDate: { $gte: todayRange.start, $lte: todayRange.end },
  });

  // Queue order is arrival order: in-consultation first, then checkInTime ascending (tie-break queueNumber)
  // Note: queueNumber is a token label, not queue order.
  const waitingAppointments = sortAppointmentsByQueueOrder(rawWaiting);

  const updatedAppointments = [];

  for (let i = 0; i < waitingAppointments.length; i++) {
    const appt = waitingAppointments[i];
    const queueLengthAhead = inConsultCount + i;

    const { predictedWaitMinutes, typicalErrorMinutes, waitPredictionSource } = await computeWaitTime({
      queueLength: queueLengthAhead,
      date: new Date(),
      departmentName,
      doctorExperience,
    });

    appt.predictedWaitMinutes = predictedWaitMinutes;
    appt.typicalErrorMinutes = typicalErrorMinutes;
    appt.waitPredictionSource = waitPredictionSource;
    await appt.save();
    updatedAppointments.push(appt);
  }

  return updatedAppointments;
};

module.exports = {
  computeWaitTime,
  updateQueueWaitEstimates,
};
