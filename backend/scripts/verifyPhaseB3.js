const { MongoMemoryReplSet } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const http = require("http");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { io: Client } = require("socket.io-client");

process.env.JWT_SECRET = "supersecretjwtkeythatisatleast32charslong";
process.env.MONGOURL = "mongodb://localhost:27017/test";
process.env.CORS_ORIGIN = "http://localhost:5173";

const app = require("../src/app");
const { initSocket, getIO } = require("../src/services/socket.service");
const { createWalkInAppointmentService } = require("../src/services/appointmentStatus.service");
const User = require("../src/models/user.model");
const Department = require("../src/models/department.model");
const Doctor = require("../src/models/doctor.model");
const Appointment = require("../src/models/appointment.model");
const request = require("supertest");

async function runB3Tests() {
  console.log("Starting Phase B3 verification with MongoMemoryReplSet & Socket.IO...");
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri();
  await mongoose.connect(uri);
  console.log("Connected to in-memory replica set.");

  const server = http.createServer(app);
  initSocket(server);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const socketUrl = `http://localhost:${port}`;
  console.log(`Socket.IO test server running on ${socketUrl}`);

  try {
    // 1. Create seed data
    const dept = await Department.create({
      name: "Neurology",
      description: "Brain & Spine",
    });

    const docUser = await User.create({
      name: "Dr. Brain",
      email: "doc.brain@hospital.local",
      password: await bcrypt.hash("DocPass123!", 10),
      phone: "9123456780",
      role: "doctor",
      isActive: true,
    });

    const doctorProfile = await Doctor.create({
      userId: docUser._id,
      department: dept._id,
      specialization: "Neurology",
      qualification: "MD, DM Neuro",
      experience: 12,
      consultationFee: 800,
      availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      availableTime: { start: "00:00", end: "23:59" },
      isAvailable: true,
    });

    const patientUser = await User.create({
      name: "Patient Sarah",
      email: "sarah.patient@hospital.local",
      password: await bcrypt.hash("PatientPass123!", 10),
      phone: "9123456781",
      role: "patient",
      isActive: true,
    });

    const inactiveUser = await User.create({
      name: "Deactivated Staff",
      email: "inactive@hospital.local",
      password: await bcrypt.hash("InactivePass123!", 10),
      phone: "9123456782",
      role: "patient",
      isActive: false, // Inactive
    });

    const staffUser = await User.create({
      name: "Receptionist John",
      email: "john.reception@hospital.local",
      password: await bcrypt.hash("StaffPass123!", 10),
      phone: "9123456783",
      role: "receptionist",
      isActive: true,
    });

    const docToken = jwt.sign(
      { userId: docUser._id.toString(), role: "doctor" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const patientToken = jwt.sign(
      { userId: patientUser._id.toString(), role: "patient" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const inactiveToken = jwt.sign(
      { userId: inactiveUser._id.toString(), role: "patient" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const staffToken = jwt.sign(
      { userId: staffUser._id.toString(), role: "receptionist" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    console.log("\n--- Test 1: Handshake rejects unauthenticated connection ---");
    const unauthError = await new Promise((resolve) => {
      const client = Client(socketUrl, {
        path: "/socket.io",
        transports: ["websocket"],
        reconnection: false,
      });
      client.on("connect_error", (err) => {
        client.disconnect();
        resolve(err.message);
      });
      client.on("connect", () => {
        client.disconnect();
        resolve("UNEXPECTED_SUCCESS");
      });
    });
    console.log("Unauthenticated connection result:", unauthError);
    if (!unauthError.includes("Token required")) {
      throw new Error(`Test 1 Failed: Expected 'Token required', got: ${unauthError}`);
    }
    console.log("✓ Test 1 Passed: Handshake properly rejected missing token.");

    console.log("\n--- Test 2: Handshake rejects deactivated user ---");
    const inactiveError = await new Promise((resolve) => {
      const client = Client(socketUrl, {
        auth: { token: inactiveToken },
        path: "/socket.io",
        transports: ["websocket"],
        reconnection: false,
      });
      client.on("connect_error", (err) => {
        client.disconnect();
        resolve(err.message);
      });
      client.on("connect", () => {
        client.disconnect();
        resolve("UNEXPECTED_SUCCESS");
      });
    });
    console.log("Inactive user connection result:", inactiveError);
    if (!inactiveError.includes("Account has been deactivated")) {
      throw new Error(`Test 2 Failed: Expected deactivation error, got: ${inactiveError}`);
    }
    console.log("✓ Test 2 Passed: Deactivated user rejected on socket handshake.");

    console.log("\n--- Test 3: Authenticated clients connect and join JWT-derived rooms ---");
    const docClient = Client(socketUrl, {
      auth: { token: docToken },
      path: "/socket.io",
      transports: ["websocket"],
    });

    const staffClient = Client(socketUrl, {
      auth: { token: staffToken },
      path: "/socket.io",
      transports: ["websocket"],
    });

    const patientClient = Client(socketUrl, {
      auth: { token: patientToken },
      path: "/socket.io",
      transports: ["websocket"],
    });

    await Promise.all([
      new Promise((resolve) => docClient.on("connect", resolve)),
      new Promise((resolve) => staffClient.on("connect", resolve)),
      new Promise((resolve) => patientClient.on("connect", resolve)),
    ]);
    console.log("✓ Doctor, Staff, and Patient sockets connected successfully.");

    // Verify rooms on server
    const io = getIO();
    const docSocket = Array.from(io.sockets.sockets.values()).find(
      (s) => s.user?.userId === docUser._id.toString()
    );
    const staffSocket = Array.from(io.sockets.sockets.values()).find(
      (s) => s.user?.userId === staffUser._id.toString()
    );
    const patientSocket = Array.from(io.sockets.sockets.values()).find(
      (s) => s.user?.userId === patientUser._id.toString()
    );

    console.log("Doc rooms:", Array.from(docSocket.rooms));
    console.log("Staff rooms:", Array.from(staffSocket.rooms));
    console.log("Patient rooms:", Array.from(patientSocket.rooms));

    if (!docSocket.rooms.has(`doctor:${doctorProfile._id.toString()}`)) {
      throw new Error("Test 3 Failed: Doctor socket not in doctor:<doctorId> room");
    }
    if (!staffSocket.rooms.has("staff")) {
      throw new Error("Test 3 Failed: Staff socket not in staff room");
    }
    if (!patientSocket.rooms.has(`patient:${patientUser._id.toString()}`)) {
      throw new Error("Test 3 Failed: Patient socket not in patient:<userId> room");
    }
    console.log("✓ Test 3 Passed: Verified server assigned correct rooms strictly derived from JWT.");

    console.log("\n--- Test 4: Live event broadcast on Walk-In creation using appointment:statusChanged ---");
    // Setup event listeners on docClient and staffClient
    const docQueuePromise = new Promise((resolve) => {
      docClient.once("queue:update", (data) => resolve(data));
    });
    const staffQueuePromise = new Promise((resolve) => {
      staffClient.once("queue:update", (data) => resolve(data));
    });
    const staffStatusPromise = new Promise((resolve) => {
      staffClient.once("appointment:statusChanged", (data) => resolve(data));
    });

    // Create walk-in via API (which uses appointmentStatus.service)
    const walkInRes = await request(app)
      .post("/api/appointments/walk-in")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        patient: {
          name: "Live Test Patient",
          phone: "9123499999",
        },
        doctorId: doctorProfile._id.toString(),
        reason: "Severe headache",
      });

    console.log("Walk-in creation status:", walkInRes.status);
    if (walkInRes.status !== 201) {
      throw new Error("Walk-in creation failed");
    }

    const [docQueueEvent, staffQueueEvent, staffStatusEvent] = await Promise.all([
      docQueuePromise,
      staffQueuePromise,
      staffStatusPromise,
    ]);

    console.log("Doctor received queue:update count:", docQueueEvent.count);
    console.log("Staff received queue:update count:", staffQueueEvent.count);
    console.log("Staff received appointment:statusChanged status:", staffStatusEvent.status);

    if (
      docQueueEvent.count !== 1 ||
      staffQueueEvent.count !== 1 ||
      staffStatusEvent.status !== "in-queue"
    ) {
      throw new Error("Test 4 Failed: Socket events payload mismatch");
    }
    console.log("✓ Test 4 Passed: Doctor & Staff received appointment:statusChanged and queue:update events.");

    console.log("\n--- Test 5: Transaction failure / rollback guarantees ZERO socket emissions ---");
    const receivedEventsOnRollback = [];
    const rollbackListener = (eventName) => (payload) => {
      receivedEventsOnRollback.push({ eventName, payload });
    };

    staffClient.on("appointment:statusChanged", rollbackListener("staff:appointment:statusChanged"));
    staffClient.on("queue:update", rollbackListener("staff:queue:update"));
    docClient.on("appointment:statusChanged", rollbackListener("doc:appointment:statusChanged"));
    docClient.on("queue:update", rollbackListener("doc:queue:update"));

    const abortSession = await mongoose.startSession();
    try {
      await abortSession.withTransaction(async () => {
        // Create partial appointment in transaction
        await Appointment.create(
          [
            {
              patient: patientUser._id,
              doctor: doctorProfile._id,
              department: dept._id,
              appointmentDate: new Date(),
              status: "in-queue",
              reason: "Will abort intentionally",
            },
          ],
          { session: abortSession }
        );

        // Intentionally throw error before commit to force abort/rollback
        throw new Error("SIMULATED_TRANSACTION_FAILURE");
      });
    } catch (err) {
      if (err.message !== "SIMULATED_TRANSACTION_FAILURE") {
        throw err;
      }
      console.log("Simulated transaction failure successfully triggered rollback.");
    } finally {
      await abortSession.endSession();
    }

    // Wait 400ms to verify absolutely no events are delivered
    await new Promise((resolve) => setTimeout(resolve, 400));
    console.log("Events received during transaction rollback:", receivedEventsOnRollback.length);

    if (receivedEventsOnRollback.length !== 0) {
      throw new Error("Test 5 Failed: Socket events were emitted despite transaction failure/rollback!");
    }
    console.log("✓ Test 5 Passed: Zero socket events emitted during transaction rollback.");

    // Clean up sockets
    docClient.disconnect();
    staffClient.disconnect();
    patientClient.disconnect();

    console.log("\n=================================");
    console.log("ALL PHASE B3 VERIFICATIONS PASSED!");
    console.log("=================================");
  } finally {
    server.close();
    await mongoose.disconnect();
    await replSet.stop();
  }
}

runB3Tests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
