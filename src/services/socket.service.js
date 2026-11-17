const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const Doctor = require("../models/doctor.model");
const Appointment = require("../models/appointment.model");
const { getKolkataDayRange } = require("../utils/timezone");

let io = null;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || "http://localhost:5173",
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
      credentials: true,
    },
  });

  // Authentication Middleware for Socket.IO Handshake
  io.use(async (socket, next) => {
    try {
      const authHeader = socket.handshake.headers.authorization;
      const token =
        socket.handshake.auth?.token ||
        (authHeader && authHeader.startsWith("Bearer ")
          ? authHeader.split(" ")[1]
          : null);

      if (!token) {
        return next(new Error("Authentication error: Token required"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!decoded || !decoded.userId) {
        return next(new Error("Authentication error: Invalid token"));
      }

      // Check DB directly - deactivation or deletion takes effect immediately
      const user = await User.findById(decoded.userId).select("_id role isActive");
      if (!user) {
        return next(new Error("Authentication error: User not found"));
      }

      if (user.isActive === false) {
        return next(new Error("Authentication error: Account has been deactivated"));
      }

      socket.user = {
        userId: user._id.toString(),
        role: user.role,
      };

      return next();
    } catch (err) {
      return next(new Error(`Authentication error: ${err.message}`));
    }
  });

  io.on("connection", async (socket) => {
    const { userId, role } = socket.user;

    // Room assignment derived STRICTLY from verified JWT (never chosen by client)
    if (role === "patient") {
      socket.join(`patient:${userId}`);
    } else if (role === "doctor") {
      try {
        const doctorProfile = await Doctor.findOne({ userId }).select("_id");
        if (doctorProfile) {
          socket.join(`doctor:${doctorProfile._id.toString()}`);
        }
      } catch (err) {
        console.error("Error resolving doctor room for socket:", err.message);
      }
      socket.join(`doctor:user:${userId}`);
    } else if (role === "receptionist" || role === "admin") {
      socket.join("staff");
    }

    socket.on("disconnect", () => {
      // Room cleanup is handled automatically by socket.io
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.io has not been initialized. Call initSocket first.");
  }
  return io;
};

// Emit status change to patient, doctor, and staff rooms
const emitAppointmentStatusChanged = async (appointment) => {
  if (!io || !appointment) return;
  try {
    const patientId =
      appointment.patient?._id?.toString() || appointment.patient?.toString();
    const doctorId =
      appointment.doctor?._id?.toString() || appointment.doctor?.toString();

    const payload = {
      appointmentId: appointment._id.toString(),
      status: appointment.status,
      appointment,
      timestamp: new Date(),
    };

    if (patientId) {
      io.to(`patient:${patientId}`).emit("appointment:status", payload);
    }
    if (doctorId) {
      io.to(`doctor:${doctorId}`).emit("appointment:status", payload);
    }
    io.to("staff").emit("appointment:status", payload);
  } catch (err) {
    console.error("Socket emitAppointmentStatusChanged error:", err.message);
  }
};

// Emit full updated daily queue for doctor to doctor, staff, and active patients
const emitQueueUpdate = async (doctorId) => {
  if (!io || !doctorId) return;
  try {
    const doctorIdStr = doctorId._id ? doctorId._id.toString() : doctorId.toString();
    const todayRange = getKolkataDayRange(new Date());

    const queue = await Appointment.find({
      doctor: doctorIdStr,
      status: { $in: ["in-queue", "in-consultation"] },
      appointmentDate: { $gte: todayRange.start, $lte: todayRange.end },
    })
      .populate("patient", "name phone email")
      .populate("department", "name")
      .sort({ queueNumber: 1, checkInTime: 1 });

    const payload = {
      doctorId: doctorIdStr,
      queue,
      count: queue.length,
      timestamp: new Date(),
    };

    io.to(`doctor:${doctorIdStr}`).to("staff").emit("queue:update", payload);

    // Also notify each patient in the queue with their current position
    queue.forEach((appt, idx) => {
      const patientId = appt.patient?._id?.toString() || appt.patient?.toString();
      if (patientId) {
        io.to(`patient:${patientId}`).emit("queue:update", {
          ...payload,
          myPosition: idx + 1,
          myAppointment: appt,
        });
      }
    });
  } catch (err) {
    console.error("Socket emitQueueUpdate error:", err.message);
  }
};

module.exports = {
  initSocket,
  getIO,
  emitAppointmentStatusChanged,
  emitQueueUpdate,
};
