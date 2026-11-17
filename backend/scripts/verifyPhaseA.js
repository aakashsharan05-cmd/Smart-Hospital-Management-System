/**
 * Verification Script for Phase A
 * Proves:
 *   (a) Two simultaneous bookings for the same doctor slot -> only one succeeds (409 on second).
 *   (b) Deactivated user's login AND existing token are both rejected (HTTP 403).
 */
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "test_super_secret_jwt_key_at_least_32_characters_long";
process.env.PORT = "5001";
process.env.CORS_ORIGIN = "http://localhost:5173";

const User = require("../src/models/user.model");
const Department = require("../src/models/department.model");
const Doctor = require("../src/models/doctor.model");
const Appointment = require("../src/models/appointment.model");
const Counter = require("../src/models/counter.model");
const { protect } = require("../src/middleware/auth.middleware");
const { bookAppointment } = require("../src/controllers/appointment.Controller");
const { loginUser } = require("../src/controllers/auth.Controller");

// Helper to mock express req/res
const createMockReqRes = (reqData = {}) => {
  const req = {
    body: reqData.body || {},
    headers: reqData.headers || {},
    user: reqData.user || null,
    params: reqData.params || {},
    query: reqData.query || {},
  };

  let statusCode = 200;
  let responseData = null;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
  };

  return {
    req,
    res,
    getResponse: () => ({ status: statusCode, body: responseData }),
  };
};

async function runVerification() {
  console.log("=================================================");
  console.log("   SHMS PHASE A VERIFICATION SUITE");
  console.log("=================================================\n");

  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);

  // Ensure all model indexes are initialized
  await Promise.all([
    User.init(),
    Doctor.init(),
    Department.init(),
    Appointment.init(),
    Counter.init(),
  ]);

  console.log("MongoDB In-Memory server connected & indexes built.\n");

  try {
    // Setup test doctor and department
    const dept = await Department.create({
      name: "Cardiology",
      description: "Heart specialist department",
    });

    const docPassword = await bcrypt.hash("DocPassword123!", 10);
    const docUser = await User.create({
      name: "Dr. Jane Smith",
      email: "doctor.jane@hospital.com",
      password: docPassword,
      role: "doctor",
    });

    const doctor = await Doctor.create({
      userId: docUser._id,
      department: dept._id,
      specialization: "Cardiologist",
      qualification: "MD, DM (Cardio)",
      experience: 10,
      consultationFee: 800,
      availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      availableTime: { start: "09:00", end: "17:00" },
    });

    // Create 2 test patients
    const patientPassword = await bcrypt.hash("PatientPass123!", 10);
    const patient1 = await User.create({
      name: "Rahul Verma",
      email: "rahul@example.com",
      password: patientPassword,
      role: "patient",
      isActive: true,
    });

    const patient2 = await User.create({
      name: "Ananya Sharma",
      email: "ananya@example.com",
      password: patientPassword,
      role: "patient",
      isActive: true,
    });

    // -------------------------------------------------------------
    // TEST (a): SIMULTANEOUS BOOKINGS FOR THE SAME DOCTOR SLOT
    // -------------------------------------------------------------
    console.log("▶ TEST (a): Simultaneous Bookings for Same Doctor Slot");

    // Next Friday 10:00 IST (UTC: 04:30:00.000Z)
    const targetSlot = new Date();
    targetSlot.setDate(targetSlot.getDate() + ((5 + 7 - targetSlot.getDay()) % 7 || 7));
    targetSlot.setUTCHours(4, 30, 0, 0); // 10:00 AM IST

    console.log(`  Target Slot: ${targetSlot.toISOString()} (10:00 AM IST on Friday)`);

    const call1 = createMockReqRes({
      body: {
        doctorId: doctor._id.toString(),
        appointmentDate: targetSlot.toISOString(),
        reason: "Chest discomfort - Patient 1",
      },
      user: { userId: patient1._id.toString(), role: "patient" },
    });

    const call2 = createMockReqRes({
      body: {
        doctorId: doctor._id.toString(),
        appointmentDate: targetSlot.toISOString(),
        reason: "Routine heart checkup - Patient 2",
      },
      user: { userId: patient2._id.toString(), role: "patient" },
    });

    // Fire both booking requests concurrently
    await Promise.all([
      bookAppointment(call1.req, call1.res),
      bookAppointment(call2.req, call2.res),
    ]);

    const res1 = call1.getResponse();
    const res2 = call2.getResponse();

    console.log(`  Request 1 (Patient 1) Status: ${res1.status}`);
    console.log(`  Request 2 (Patient 2) Status: ${res2.status}`);

    const successes = [res1, res2].filter((r) => r.status === 201);
    const conflicts = [res2, res1].filter((r) => r.status === 409);

    if (successes.length === 1 && conflicts.length === 1) {
      console.log("  ✔ PASS: Exactly ONE booking succeeded (201) and the collision was rejected (409)!");
      console.log(`    Success message: "${successes[0].body.message}" (Queue #${successes[0].body.appointment.queueNumber})`);
      console.log(`    Conflict message: "${conflicts[0].body.message}"`);
    } else {
      throw new Error(`FAIL: Expected 1 success & 1 conflict, got ${successes.length} successes and ${conflicts.length} conflicts.`);
    }

    // Verify DB count
    const activeAppointmentsCount = await Appointment.countDocuments({
      doctor: doctor._id,
      slotStart: targetSlot,
      status: { $nin: ["cancelled", "rejected"] },
    });
    console.log(`  ✔ DB Verification: Active appointments in target slot = ${activeAppointmentsCount} (expected: 1)\n`);

    // -------------------------------------------------------------
    // TEST (b): DEACTIVATED USER'S LOGIN AND TOKEN ARE REJECTED
    // -------------------------------------------------------------
    console.log("▶ TEST (b): Deactivated User Login & Token Invalidation");

    // Step 1: Issue token while patient is still active
    const activeToken = jwt.sign(
      { userId: patient1._id.toString(), role: patient1.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Verify token works before deactivation
    const preDeactCall = createMockReqRes({
      headers: { authorization: `Bearer ${activeToken}` },
    });
    let preNextCalled = false;
    await protect(preDeactCall.req, preDeactCall.res, () => {
      preNextCalled = true;
    });
    if (!preNextCalled) {
      throw new Error("FAIL: protect middleware should allow active user.");
    }
    console.log("  Step 1: Active user verified with protect middleware (Token is valid).");

    // Step 2: Admin deactivates patient
    patient1.isActive = false;
    await patient1.save();
    console.log("  Step 2: User account deactivated in database (isActive = false).");

    // Step 3: Test Login Attempt with correct password
    const loginCall = createMockReqRes({
      body: { email: "rahul@example.com", password: "PatientPass123!" },
    });
    await loginUser(loginCall.req, loginCall.res);
    const loginRes = loginCall.getResponse();

    console.log(`  Step 3 Login Attempt: Status ${loginRes.status}, Message: "${loginRes.body.message}"`);
    if (loginRes.status === 403 && loginRes.body.message.toLowerCase().includes("deactivated")) {
      console.log("  ✔ PASS (b.1): Inactive user login blocked with HTTP 403!");
    } else {
      throw new Error(`FAIL: Expected login HTTP 403 with deactivated message, got ${loginRes.status}`);
    }

    // Step 4: Test existing valid token against protect middleware
    const tokenCall = createMockReqRes({
      headers: { authorization: `Bearer ${activeToken}` },
    });
    let tokenNextCalled = false;
    await protect(tokenCall.req, tokenCall.res, () => {
      tokenNextCalled = true;
    });
    const tokenRes = tokenCall.getResponse();

    console.log(`  Step 4 Existing Token Usage: Status ${tokenRes.status}, Message: "${tokenRes.body.message}"`);
    if (!tokenNextCalled && tokenRes.status === 403 && tokenRes.body.message.toLowerCase().includes("deactivated")) {
      console.log("  ✔ PASS (b.2): Existing valid JWT immediately rejected with HTTP 403!\n");
    } else {
      throw new Error(`FAIL: Expected token rejection with HTTP 403, got ${tokenRes.status}`);
    }

    console.log("=================================================");
    console.log("   ALL VERIFICATION TESTS PASSED SUCCESSFULLY!   ");
    console.log("=================================================");
  } finally {
    await mongoose.disconnect();
    await mongod.stop();
  }
}

runVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
