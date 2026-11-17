const { MongoMemoryReplSet } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");
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

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/health`);
      if (res.ok) {
        const data = await res.json();
        if (data.model_loaded) return true;
      }
    } catch (e) {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Timeout waiting for server at ${url}`);
}

async function runB4Tests() {
  console.log("Starting Phase B4 verification: Real Python FastAPI & ML Model Integration...");
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri();
  await mongoose.connect(uri);
  console.log("Connected to in-memory replica set.");

  const server = http.createServer(app);
  initSocket(server);

  let mlProcess = null;

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

    // 2. Launch actual Python FastAPI server and test real ML Model inference
    console.log("\n--- Test 2: Actual Python FastAPI Service & RandomForest Model Prediction ---");
    const pythonExe = path.join(__dirname, "..", "ml-service", ".venv", "Scripts", "python.exe");
    const mlDir = path.join(__dirname, "..", "ml-service");
    const realPort = 8005;
    const realMlUrl = `http://127.0.0.1:${realPort}`;

    console.log(`Starting real FastAPI service via: ${pythonExe} in ${mlDir}...`);
    mlProcess = spawn(
      pythonExe,
      ["-m", "uvicorn", "app:app", "--port", realPort.toString(), "--host", "127.0.0.1"],
      { cwd: mlDir, stdio: "pipe" }
    );

    mlProcess.stderr.on("data", (d) => {
      // console.error(`[FastAPI err]: ${d}`);
    });

    await waitForServer(realMlUrl);
    console.log(`✓ Real FastAPI server is UP and verified at ${realMlUrl} with trained model loaded.`);

    process.env.ML_SERVICE_URL = realMlUrl;

    // Test real model prediction through Node.js computeWaitTime
    const livePrediction = await computeWaitTime({
      queueLength: 5,
      date: new Date(),
      departmentName: "Cardiology",
      doctorExperience: 10,
    });
    console.log("Real ML Model prediction output from FastAPI:", livePrediction);

    if (
      livePrediction.waitPredictionSource !== "ml-model" ||
      typeof livePrediction.predictedWaitMinutes !== "number" ||
      livePrediction.predictedWaitMinutes < 30 ||
      livePrediction.predictedWaitMinutes > 120
    ) {
      throw new Error(`Test 2 Failed: Unexpected model output: ${JSON.stringify(livePrediction)}`);
    }
    console.log(`✓ Test 2 Passed: Real RandomForestRegressor predicted ${livePrediction.predictedWaitMinutes} min with source 'ml-model'.`);

    // 3. Test 1.5s Timeout handling with a delayed mock server
    console.log("\n--- Test 3: 1.5s Timeout handling when ML service hangs ---");
    let hangingServer = http.createServer((req, res) => {
      setTimeout(() => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ predicted_wait_minutes: 99 }));
      }, 2500);
    });
    await new Promise((r) => hangingServer.listen(0, r));
    const hangingPort = hangingServer.address().port;
    process.env.ML_SERVICE_URL = `http://127.0.0.1:${hangingPort}`;

    const startT = Date.now();
    const timeoutResult = await computeWaitTime({ queueLength: 2 });
    const elapsed = Date.now() - startT;
    console.log(`Elapsed time: ${elapsed}ms, Result:`, timeoutResult);

    if (
      elapsed > 2000 ||
      timeoutResult.predictedWaitMinutes !== 21 ||
      timeoutResult.waitPredictionSource !== "fallback-formula"
    ) {
      throw new Error("Test 3 Failed: Did not abort at 1.5s timeout or fallback formula failed");
    }
    console.log("✓ Test 3 Passed: 1.5s timeout triggered; smoothly fell back to heuristic without crashing.");

    hangingServer.close();

    // Point back to real FastAPI service for end-to-end integration
    process.env.ML_SERVICE_URL = realMlUrl;

    // 4. Test dynamic wait time updates across appointments
    console.log("\n--- Test 4: Dynamic wait time recalculation across all lifecycle events ---");
    const dept = await Department.create({ name: "Cardiology", description: "Heart Care" });
    const docUser = await User.create({
      name: "Dr. Heart",
      email: "heart@hospital.local",
      password: await bcrypt.hash("Pass123!", 10),
      phone: "9111222333",
      role: "doctor",
      isActive: true,
    });
    const doctor = await Doctor.create({
      userId: docUser._id,
      department: dept._id,
      specialization: "Cardiology",
      qualification: "MD, DM Cardiology",
      experience: 12,
      consultationFee: 700,
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
      email: "staff.heart@hospital.local",
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

    // 4a. Walk-in 1 creation for Dr. Heart
    const resW1 = await request(app)
      .post("/api/appointments/walk-in")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        patientId: patient1._id.toString(),
        doctorId: doctor._id.toString(),
        reason: "Chest discomfort",
      });
    const appt1Id = resW1.body.appointment._id;
    console.log("Walk-in 1 wait time (ML model):", resW1.body.appointment?.predictedWaitMinutes, "source:", resW1.body.appointment?.waitPredictionSource);
    if (resW1.body.appointment?.waitPredictionSource !== "ml-model") {
      throw new Error("Test 4a Failed: Expected waitPredictionSource to be 'ml-model'");
    }

    // 4b. Walk-in 2 creation
    const resW2 = await request(app)
      .post("/api/appointments/walk-in")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        patientId: patient2._id.toString(),
        doctorId: doctor._id.toString(),
        reason: "Palpitations",
      });
    const appt2Id = resW2.body.appointment._id;
    console.log("Walk-in 2 wait time (ML model):", resW2.body.appointment?.predictedWaitMinutes, "source:", resW2.body.appointment?.waitPredictionSource);
    // Walk-in 2 has 1 person ahead -> wait time should be greater than walk-in 1
    if (resW2.body.appointment?.predictedWaitMinutes <= resW1.body.appointment?.predictedWaitMinutes) {
      throw new Error("Test 4b Failed: Second patient wait time should be greater than first patient");
    }

    // 4c. Check-in of a confirmed appointment (Patient 3)
    const confirmedAppt = await Appointment.create({
      patient: patient3._id,
      doctor: doctor._id,
      department: dept._id,
      appointmentDate: new Date(),
      status: "confirmed",
      reason: "Annual ECG",
      queueNumber: 3,
    });
    const resCheckIn = await request(app)
      .patch(`/api/appointments/${confirmedAppt._id}/check-in`)
      .set("Authorization", `Bearer ${staffToken}`);
    console.log("Patient 3 check-in wait time (ML model):", resCheckIn.body.appointment?.predictedWaitMinutes);
    if (resCheckIn.body.appointment?.predictedWaitMinutes <= resW2.body.appointment?.predictedWaitMinutes) {
      throw new Error("Test 4c Failed: Third patient wait time should be greater than second patient");
    }

    // 4d. Doctor starts consultation with Patient 1
    const resStart = await request(app)
      .patch(`/api/appointments/${appt1Id}/start-consultation`)
      .set("Authorization", `Bearer ${docToken}`);
    console.log("Patient 1 started consultation. Status:", resStart.body.appointment?.status);

    // 4e. Doctor ends consultation with Patient 1
    const resEnd = await request(app)
      .patch(`/api/appointments/${appt1Id}/end-consultation`)
      .set("Authorization", `Bearer ${docToken}`)
      .send({ consultationNotes: "Normal sinus rhythm, advised lifestyle mod" });
    console.log("Patient 1 ended consultation. Status:", resEnd.body.appointment?.status);

    // Patient 2 is now first in queue with 0 ahead -> wait time should decrease!
    const appt2AfterEnd = await Appointment.findById(appt2Id);
    console.log("Patient 2 wait time after consult end (now 1st):", appt2AfterEnd.predictedWaitMinutes);
    if (appt2AfterEnd.predictedWaitMinutes > 20) {
      throw new Error("Test 4e Failed: Patient 2 wait time should have significantly decreased after consult end");
    }

    // 4f. Cancellation of Patient 3
    const resCancel = await request(app)
      .patch(`/api/appointments/${confirmedAppt._id}/cancel`)
      .set("Authorization", `Bearer ${p3Token}`)
      .send({ cancellationReason: "Feeling better" });
    console.log("Patient 3 cancelled status:", resCancel.body.appointment?.status);

    console.log("✓ Test 4 Passed: Real ML Model predictions dynamically updated across walk-in, check-in, start, end, and cancel.");

    // 5. Test Endpoint GET /api/appointments/:id/wait-estimate
    console.log("\n--- Test 5: GET /api/appointments/:id/wait-estimate endpoint ---");

    // Patient 2 accesses their own wait estimate
    const estimateRes = await request(app)
      .get(`/api/appointments/${appt2Id}/wait-estimate`)
      .set("Authorization", `Bearer ${p2Token}`);

    console.log("Patient 2 wait-estimate response:", estimateRes.body);
    if (
      estimateRes.status !== 200 ||
      estimateRes.body.queuePosition !== 1 ||
      estimateRes.body.waitPredictionSource !== "ml-model" ||
      typeof estimateRes.body.predictedWaitMinutes !== "number"
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
    if (mlProcess) {
      mlProcess.kill();
    }
    server.close();
    await mongoose.disconnect();
    await replSet.stop();
  }
}

runB4Tests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
