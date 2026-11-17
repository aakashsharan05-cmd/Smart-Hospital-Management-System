const http = require("http");
const { io: Client } = require("socket.io-client");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/user.model");
const Department = require("../src/models/department.model");
const Doctor = require("../src/models/doctor.model");
const { initSocket } = require("../src/services/socket.service");
const { createWalkInAppointmentService } = require("../src/services/appointmentStatus.service");
const { setupTestDb, teardownTestDb } = require("./testHelper");

describe("Socket.IO Authentication, Rooms & Rollback Suppression Tests", () => {
  let server, port, doctorUser, doctor, patientUser, activeToken, inactiveToken;

  beforeAll(async () => {
    const dbSetup = await setupTestDb();
    server = dbSetup.server;
    await new Promise((r) => server.listen(0, r));
    port = server.address().port;

    const dept = await Department.create({
      name: "Orthopedics",
      description: "Bone care",
      isActive: true,
    });

    const hashedPassword = await bcrypt.hash("Pass123!", 10);

    doctorUser = await User.create({
      name: "Dr. Bones",
      email: "dr.bones@hospital.com",
      password: hashedPassword,
      phone: "+919666600001",
      role: "doctor",
      isActive: true,
    });

    doctor = await Doctor.create({
      userId: doctorUser._id,
      department: dept._id,
      specialization: "Orthopedic Surgeon",
      qualification: "MS Ortho",
      consultationFee: 50,
      experience: 15,
      isAvailable: true,
    });

    patientUser = await User.create({
      name: "Active Socket Patient",
      email: "active.socket@hospital.com",
      password: hashedPassword,
      phone: "+919666600002",
      role: "patient",
      isActive: true,
    });

    const inactiveUser = await User.create({
      name: "Inactive Socket User",
      email: "inactive.socket@hospital.com",
      password: hashedPassword,
      phone: "+919666600003",
      role: "patient",
      isActive: false,
    });

    activeToken = jwt.sign(
      { userId: patientUser._id.toString(), role: "patient" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    inactiveToken = jwt.sign(
      { userId: inactiveUser._id.toString(), role: "patient" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  test("Socket handshake rejects inactive user with authentication error", (done) => {
    const socket = Client(`http://127.0.0.1:${port}`, {
      auth: { token: inactiveToken },
      transports: ["websocket"],
      reconnection: false,
    });

    socket.on("connect_error", (err) => {
      expect(err.message).toMatch(/deactivated|authentication/i);
      socket.disconnect();
      done();
    });

    socket.on("connect", () => {
      socket.disconnect();
      done(new Error("Inactive user socket connection was unexpectedly accepted"));
    });
  });

  test("Socket handshake succeeds for active user", (done) => {
    const socket = Client(`http://127.0.0.1:${port}`, {
      auth: { token: activeToken },
      transports: ["websocket"],
      reconnection: false,
    });

    socket.on("connect", () => {
      expect(socket.connected).toBe(true);
      socket.disconnect();
      done();
    });

    socket.on("connect_error", (err) => {
      socket.disconnect();
      done(err);
    });
  });

  test("Transaction rollback suppression: no socket event emitted when transaction aborts", async () => {
    const socket = Client(`http://127.0.0.1:${port}`, {
      auth: { token: activeToken },
      transports: ["websocket"],
      reconnection: false,
    });

    await new Promise((resolve) => socket.on("connect", resolve));

    let eventEmitted = false;
    socket.on("appointment:statusChanged", () => {
      eventEmitted = true;
    });

    // Start manual transaction and intentionally abort
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      await createWalkInAppointmentService({
        patient: { name: "Failed Walkin", phone: "+919666699999" },
        doctorId: doctor._id.toString(),
        reason: "Test rollback",
        customSession: session,
      });

      // Intentionally abort transaction
      await session.abortTransaction();
    } catch (e) {
      // Expected
    } finally {
      await session.endSession();
    }

    // Wait 400ms to ensure no delayed event was broadcast
    await new Promise((r) => setTimeout(r, 400));
    expect(eventEmitted).toBe(false);
    socket.disconnect();
  });

  test("Privacy: Patient A receives strictly isolated payload with no trace of Patient B name/phone/email", async () => {
    // 1. Create Patient A and Patient B
    const patientAUser = await User.create({
      name: "Patient Alice",
      email: "alice.privacy@hospital.com",
      password: await bcrypt.hash("Pass123!", 10),
      phone: "+919555511111",
      role: "patient",
      isActive: true,
    });

    const patientBUser = await User.create({
      name: "Patient Bob Secret",
      email: "bob.sensitive@hospital.com",
      password: await bcrypt.hash("Pass123!", 10),
      phone: "+919555522222",
      role: "patient",
      isActive: true,
    });

    const tokenA = jwt.sign(
      { userId: patientAUser._id.toString(), role: "patient" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 2. Connect Patient A socket
    const socketA = Client(`http://127.0.0.1:${port}`, {
      auth: { token: tokenA },
      transports: ["websocket"],
      reconnection: false,
    });

    await new Promise((resolve) => socketA.on("connect", resolve));

    // 3. Register Patient A as walk-in
    await createWalkInAppointmentService({
      patientId: patientAUser._id.toString(),
      doctorId: doctor._id.toString(),
      reason: "Patient A consultation",
    });

    // Prepare listener on socketA for queue:update
    const queueUpdatePromise = new Promise((resolve) => {
      socketA.on("queue:update", (data) => {
        resolve(data);
      });
    });

    // Register Patient B (triggers emitQueueUpdate)
    await createWalkInAppointmentService({
      patientId: patientBUser._id.toString(),
      doctorId: doctor._id.toString(),
      reason: "Patient B consultation",
    });

    const payloadA = await queueUpdatePromise;

    // Verify Patient A payload structure: ONLY allowed fields
    expect(payloadA).toHaveProperty("doctorId");
    expect(payloadA).toHaveProperty("myPosition");
    expect(payloadA).toHaveProperty("patientsAhead");
    expect(payloadA).toHaveProperty("queueCount");
    expect(payloadA).toHaveProperty("myAppointment");
    expect(payloadA).toHaveProperty("timestamp");

    // Must NOT have 'queue' array of all patients
    expect(payloadA.queue).toBeUndefined();

    // Verify myAppointment structure
    expect(payloadA.myAppointment).toHaveProperty("_id");
    expect(payloadA.myAppointment).toHaveProperty("status");
    expect(payloadA.myAppointment).toHaveProperty("queueNumber");
    expect(payloadA.myAppointment).toHaveProperty("predictedWaitMinutes");
    expect(payloadA.myAppointment).toHaveProperty("typicalErrorMinutes");
    expect(payloadA.myAppointment).toHaveProperty("waitPredictionSource");

    // Zero trace of Patient B's PII in payload
    const serialized = JSON.stringify(payloadA);
    expect(serialized).not.toContain("Bob");
    expect(serialized).not.toContain("bob.sensitive@hospital.com");
    expect(serialized).not.toContain("+919555522222");
    expect(serialized).not.toContain("9555522222");

    socketA.disconnect();
  });
});
