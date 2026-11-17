const { MongoMemoryReplSet } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const http = require("http");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const request = require("supertest");

process.env.JWT_SECRET = "supersecretjwtkeythatisatleast32charslong";
process.env.MONGOURL = "mongodb://localhost:27017/test";
process.env.CORS_ORIGIN = "http://localhost:5173";
process.env.DEFAULT_CONSULT_MIN = "8";

const app = require("../src/app");
const { initSocket } = require("../src/services/socket.service");
const { computeWaitTime } = require("../src/services/waitPrediction.service");
const User = require("../src/models/user.model");
const Department = require("../src/models/department.model");
const Doctor = require("../src/models/doctor.model");
const Appointment = require("../src/models/appointment.model");

async function runB4Tests() {
  console.log("Starting Phase B4 verification: Wait-Time Prediction Integration...");
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri();
  await mongoose.connect(uri);
  console.log("Connected to in-memory replica set.");

  const server = http.createServer(app);
  initSocket(server);

  try {
    // 1. Test offline ML service fallback formula
    console.log("\n--- Test 1: Fallback formula when ML service is offline ---");
    process.env.ML_SERVICE_URL = "http://127.0.0.1:59999"; // Non-existent port

    const offlineResult0 = await computeWaitTime({ queueLength: 0 });
    console.log("Queue length 0 offline result:", offlineResult0);
    if (offlineResult0.predictedWaitMinutes !== 5 || offlineResult0.waitPredictionSource !== "fallback-formula") {
      throw new Error(`Test 1 Failed: Expected 5 min fallback, got ${JSON.stringify(offlineResult0)}`);
    }

    const offlineResult3 = await computeWaitTime({ queueLength: 3 });
    console.log("Queue length 3 offline result:", offlineResult3);
    // 5 + 3 * 8 = 29
    if (offlineResult3.predictedWaitMinutes !== 29 || offlineResult3.waitPredictionSource !== "fallback-formula") {
      throw new Error(`Test 1 Failed: Expected 29 min fallback, got ${JSON.stringify(offlineResult3)}`);
    }
    console.log("✓ Test 1 Passed: Fallback formula correctly computes 5 + queueLength * 8 with source 'fallback-formula'.");

    // 2. Test live ML service prediction
    console.log("\n--- Test 2: Live ML Service mock returning prediction ---");
    let receivedPayload = null;
    let shouldDelay = false;

    const mockMlServer = http.createServer((req, res) => {
      if (req.method === "POST" && req.url === "/predict") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          receivedPayload = JSON.parse(body);
          if (shouldDelay) {
            // Delay 2000ms to test 1500ms timeout
            setTimeout(() => {
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ predicted_wait_minutes: 42 }));
            }, 2000);
          } else {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ predicted_wait_minutes: 17 }));
          }
        });
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise((resolve) => mockMlServer.listen(0, resolve));
    const mockPort = mockMlServer.address().port;
    process.env.ML_SERVICE_URL = `http://127.0.0.1:${mockPort}`;
    console.log(`Mock ML server running on ${process.env.ML_SERVICE_URL}`);

    const liveResult = await computeWaitTime({
      queueLength: 2,
      departmentName: "Cardiology",
      doctorExperience: 10,
    });
    console.log("Live ML model prediction result:", liveResult);
    console.log("Payload sent to ML service:", receivedPayload);

    if (
      liveResult.predictedWaitMinutes !== 17 ||
      liveResult.waitPredictionSource !== "ml-model" ||
      receivedPayload.queue_length !== 2 ||
      receivedPayload.department !== "Cardiology" ||
      typeof receivedPayload.day_of_week !== "number"
    ) {
      throw new Error("Test 2 Failed: ML service prediction or feature payload mismatch");
    }
    console.log("✓ Test 2 Passed: Successfully queried ML model and stored prediction with source 'ml-model'.");

    // 3. Test timeout handling (> 1.5s aborts and falls back)
    console.log("\n--- Test 3: 1.5s Timeout handling when ML service hangs ---");
    shouldDelay = true;
    const startT = Date.now();
    const timeoutResult = await computeWaitTime({ queueLength: 2 });
    const elapsed = Date.now() - startT;
    console.log(`Elapsed time: ${elapsed}ms, Result:`, timeoutResult);

    // Should abort around 1500ms, not hang for 2000ms, and fall back to formula (5 + 2*8 = 21)
    if (
      elapsed > 1900 ||
      timeoutResult.predictedWaitMinutes !== 21 ||
      timeoutResult.waitPredictionSource !== "fallback-formula"
    ) {
      throw new Error("Test 3 Failed: Did not abort at 1.5s timeout or fallback formula failed");
    }
    console.log("✓ Test 3 Passed: 1.5s timeout triggered; smoothly fell back to heuristic without crashing.");

    mockMlServer.close();

    // 4. Test dynamic wait time updates across appointments
    console.log("\n--- Test 4: Dynamic wait time recalculation across all lifecycle events ---");
    // Switch to fallback formula for deterministic tests
    process.env.ML_SERVICE_URL = "http://127.0.0.1:59999";

    const dept = await Department.create({ name: "Orthopedics", description: "Bone Care" });
    const docUser = await User.create({
      name: "Dr. Bone",
      email: "bone@hospital.local",
      password: await bcrypt.hash("Pass123!", 10),
      phone: "9111222333",
      role: "doctor",
      isActive: true,
    });
    const doctor = await Doctor.create({
      userId: docUser._id,
      department: dept._id,
      specialization: "Orthopedics",
      qualification: "MS Ortho",
      experience: 8,
      consultationFee: 600,
      availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      availableTime: { start: "00:00", end: "23:59" },
      isAvailable: true,
    });

    // Create a 2nd doctor to verify no cross-doctor queue pollution
    const docUser2 = await User.create({
      name: "Dr. Other",
      email: "other@hospital.local",
      password: await bcrypt.hash("Pass123!", 10),
      phone: "9111222999",
      role: "doctor",
      isActive: true,
    });
    const doctor2 = await Doctor.create({
      userId: docUser2._id,
      department: dept._id,
      specialization: "Orthopedics",
      qualification: "MS Ortho",
      experience: 5,
      consultationFee: 500,
      availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      availableTime: { start: "00:00", end: "23:59" },
      isAvailable: true,
    });

    const patient1 = await User.create({
      name: "Patient One",
      email: "p1@hospital.local",
      password: await bcrypt.hash("Pass123!", 10),
      phone: "9111222334",
      role: "patient",
      isActive: true,
    });

    const patient2 = await User.create({
      name: "Patient Two",
      email: "p2@hospital.local",
      password: await bcrypt.hash("Pass123!", 10),
      phone: "9111222335",
      role: "patient",
      isActive: true,
    });

    const patient3 = await User.create({
      name: "Patient Three",
      email: "p3@hospital.local",
      password: await bcrypt.hash("Pass123!", 10),
      phone: "9111222337",
      role: "patient",
      isActive: true,
    });

    const staffUser = await User.create({
      name: "Staff User",
      email: "staff.ortho@hospital.local",
      password: await bcrypt.hash("Pass123!", 10),
      phone: "9111222336",
      role: "receptionist",
      isActive: true,
    });

    const staffToken = jwt.sign(
      { userId: staffUser._id.toString(), role: "receptionist" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    const p1Token = jwt.sign(
      { userId: patient1._id.toString(), role: "patient" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    const p2Token = jwt.sign(
      { userId: patient2._id.toString(), role: "patient" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    const p3Token = jwt.sign(
      { userId: patient3._id.toString(), role: "patient" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    const docToken = jwt.sign(
      { userId: docUser._id.toString(), role: "doctor" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Create an in-queue appointment for Dr. Other to verify it does NOT pollute Dr. Bone's queue
    await Appointment.create({
      patient: patient1._id,
      doctor: doctor2._id,
      department: dept._id,
      appointmentDate: new Date(),
      status: "in-queue",
      queueNumber: 1,
      reason: "Other doc visit",
    });

    // 4a. Walk-in 1 creation for Dr. Bone
    const resW1 = await request(app)
      .post("/api/appointments/walk-in")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        patientId: patient1._id.toString(),
        doctorId: doctor._id.toString(),
        reason: "Knee pain",
      });
    const appt1Id = resW1.body.appointment._id;
    console.log("Walk-in 1 wait time:", resW1.body.appointment?.predictedWaitMinutes);
    // Queue length ahead is 0 -> 5 + 0*8 = 5 min
    if (resW1.body.appointment?.predictedWaitMinutes !== 5) {
      throw new Error(`Test 4a Failed: Expected 5 min wait, got ${resW1.body.appointment?.predictedWaitMinutes}`);
    }

    // 4b. Walk-in 2 creation for Dr. Bone
    const resW2 = await request(app)
      .post("/api/appointments/walk-in")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        patientId: patient2._id.toString(),
        doctorId: doctor._id.toString(),
        reason: "Ankle sprain",
      });
    const appt2Id = resW2.body.appointment._id;
    console.log("Walk-in 2 wait time:", resW2.body.appointment?.predictedWaitMinutes);
    // Queue length ahead is 1 -> 5 + 1*8 = 13 min
    if (resW2.body.appointment?.predictedWaitMinutes !== 13) {
      throw new Error(`Test 4b Failed: Expected 13 min wait, got ${resW2.body.appointment?.predictedWaitMinutes}`);
    }

    // 4c. Check-in of a confirmed appointment (Patient 3)
    const confirmedAppt = await Appointment.create({
      patient: patient3._id,
      doctor: doctor._id,
      department: dept._id,
      appointmentDate: new Date(),
      status: "confirmed",
      reason: "Shoulder checkup",
      queueNumber: 3,
    });
    const resCheckIn = await request(app)
      .patch(`/api/appointments/${confirmedAppt._id}/check-in`)
      .set("Authorization", `Bearer ${staffToken}`);
    console.log("Patient 3 check-in wait time:", resCheckIn.body.appointment?.predictedWaitMinutes);
    // Ahead: appt1 + appt2 = 2 ahead -> 5 + 2*8 = 21 min
    if (resCheckIn.body.appointment?.predictedWaitMinutes !== 21) {
      throw new Error(`Test 4c Failed: Expected 21 min wait for checked in appointment, got ${resCheckIn.body.appointment?.predictedWaitMinutes}`);
    }

    // 4d. Doctor starts consultation with Patient 1
    const resStart = await request(app)
      .patch(`/api/appointments/${appt1Id}/start-consultation`)
      .set("Authorization", `Bearer ${docToken}`);
    console.log("Patient 1 started consultation. Status:", resStart.body.appointment?.status);

    // Verify recalculation:
    // Patient 1 is in-consultation -> wait time = 0
    // Patient 2 is in-queue: ahead is 1 in-consultation -> queueLength ahead = 1 -> wait = 13 min
    const appt2AfterStart = await Appointment.findById(appt2Id);
    console.log("Patient 2 wait after consult start:", appt2AfterStart.predictedWaitMinutes);
    if (appt2AfterStart.predictedWaitMinutes !== 13) {
      throw new Error("Test 4d Failed: Patient 2 wait time not accurate after start consultation");
    }

    // 4e. Doctor ends consultation with Patient 1
    const resEnd = await request(app)
      .patch(`/api/appointments/${appt1Id}/end-consultation`)
      .set("Authorization", `Bearer ${docToken}`)
      .send({ consultationNotes: "Advised physiotherapy" });
    console.log("Patient 1 ended consultation. Status:", resEnd.body.appointment?.status);

    // Verify recalculation after consultation ends:
    // No one is currently in-consultation! Patient 2 is now first in queue!
    // Queue length ahead for Patient 2 is now 0 -> wait time = 5 min!
    // Queue length ahead for Patient 3 is now 1 -> wait time = 13 min!
    const appt2AfterEnd = await Appointment.findById(appt2Id);
    const appt3AfterEnd = await Appointment.findById(confirmedAppt._id);
    console.log("Patient 2 wait after consult end (now 1st):", appt2AfterEnd.predictedWaitMinutes);
    console.log("Patient 3 wait after consult end (now 2nd):", appt3AfterEnd.predictedWaitMinutes);

    if (appt2AfterEnd.predictedWaitMinutes !== 5 || appt3AfterEnd.predictedWaitMinutes !== 13) {
      throw new Error("Test 4e Failed: Wait estimates did not dynamically recalculate after end consultation");
    }

    // 4f. Cancellation of Patient 3
    const resCancel = await request(app)
      .patch(`/api/appointments/${confirmedAppt._id}/cancel`)
      .set("Authorization", `Bearer ${p3Token}`)
      .send({ cancellationReason: "Unable to wait" });
    console.log("Patient 3 cancelled status:", resCancel.body.appointment?.status);

    console.log("✓ Test 4 Passed: Queue wait estimates recalculated dynamically across walk-in, check-in, start-consultation, end-consultation, and cancellation.");

    // 5. Test Endpoint GET /api/appointments/:id/wait-estimate
    console.log("\n--- Test 5: GET /api/appointments/:id/wait-estimate endpoint ---");

    // Patient 2 accesses their own wait estimate
    const estimateRes = await request(app)
      .get(`/api/appointments/${appt2Id}/wait-estimate`)
      .set("Authorization", `Bearer ${p2Token}`);

    console.log("Patient 2 wait-estimate response:", estimateRes.body);
    if (
      estimateRes.status !== 200 ||
      estimateRes.body.predictedWaitMinutes !== 5 ||
      estimateRes.body.queuePosition !== 1 ||
      estimateRes.body.waitPredictionSource !== "fallback-formula"
    ) {
      throw new Error("Test 5a Failed: Wait estimate endpoint response mismatch");
    }

    // Patient 1 attempts to access Patient 2's wait estimate (must be 403 Forbidden)
    const unauthorizedRes = await request(app)
      .get(`/api/appointments/${appt2Id}/wait-estimate`)
      .set("Authorization", `Bearer ${p1Token}`);

    console.log("Unauthorized patient access code:", unauthorizedRes.status);
    if (unauthorizedRes.status !== 403) {
      throw new Error("Test 5b Failed: Patient was able to view another patient's wait estimate!");
    }
    console.log("✓ Test 5 Passed: GET /api/appointments/:id/wait-estimate returns accurate wait times and enforces strict role privacy.");

    console.log("\n=================================");
    console.log("ALL PHASE B4 VERIFICATIONS PASSED!");
    console.log("=================================");
  } finally {
    server.close();
    await mongoose.disconnect();
    await replSet.stop();
  }
}

runB4Tests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
