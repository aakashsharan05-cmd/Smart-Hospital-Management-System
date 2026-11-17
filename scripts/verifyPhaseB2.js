const { MongoMemoryReplSet } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

process.env.JWT_SECRET = "supersecretjwtkeythatisatleast32charslong";
process.env.MONGOURL = "mongodb://localhost:27017/test";
process.env.CORS_ORIGIN = "http://localhost:5173";

const app = require("../src/app");
const User = require("../src/models/user.model");
const Department = require("../src/models/department.model");
const Doctor = require("../src/models/doctor.model");
const Appointment = require("../src/models/appointment.model");

async function runB2Tests() {
  console.log("Starting Phase B2 verification with MongoMemoryReplSet...");
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri();

  await mongoose.connect(uri);
  console.log("Connected to in-memory replica set.");

  try {
    // 1. Setup seed data: Department, Doctor User, Doctor Profile, Receptionist User
    const dept = await Department.create({
      name: "Cardiology",
      description: "Heart Care",
    });

    const docPassword = await bcrypt.hash("DocPass123!", 10);
    const docUser = await User.create({
      name: "Dr. Alice Heart",
      email: "alice.doctor@hospital.local",
      password: docPassword,
      phone: "9876543210",
      role: "doctor",
      isActive: true,
    });

    const doctorProfile = await Doctor.create({
      userId: docUser._id,
      department: dept._id,
      specialization: "Cardiology",
      qualification: "MD, DM Cardiology",
      experience: 10,
      consultationFee: 700,
      availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      availableTime: { start: "00:00", end: "23:59" },
      isAvailable: true,
    });

    const recPassword = await bcrypt.hash("RecPass123!", 10);
    const recUser = await User.create({
      name: "Front Desk Staff",
      email: "reception@hospital.local",
      password: recPassword,
      phone: "9876543211",
      role: "receptionist",
      isActive: true,
    });

    const recToken = jwt.sign(
      { userId: recUser._id.toString(), role: recUser.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const docToken = jwt.sign(
      { userId: docUser._id.toString(), role: docUser.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    console.log("\n--- Test 1: Receptionist creates walk-in patient without email ---");
    const walkInRes1 = await request(app)
      .post("/api/appointments/walk-in")
      .set("Authorization", `Bearer ${recToken}`)
      .send({
        patient: {
          name: "Walkin Patient One",
          phone: "9900112233",
        },
        doctorId: doctorProfile._id.toString(),
        reason: "Acute chest discomfort",
      });

    console.log("Walk-in response code:", walkInRes1.status);
    console.log("Walk-in status:", walkInRes1.body.appointment?.status);
    console.log("Walk-in queueNumber:", walkInRes1.body.appointment?.queueNumber);
    console.log("Generated patient email:", walkInRes1.body.appointment?.patient?.email);

    if (
      walkInRes1.status !== 201 ||
      walkInRes1.body.appointment?.status !== "in-queue" ||
      walkInRes1.body.appointment?.queueNumber !== 1 ||
      !walkInRes1.body.appointment?.patient?.email.endsWith("@hospital.local")
    ) {
      throw new Error("Test 1 Failed: Walk-in creation mismatch");
    }
    console.log("✓ Test 1 Passed: Walk-in patient created, placed in-queue with queueNumber 1 and placeholder email.");

    console.log("\n--- Test 2: Second walk-in with SAME phone reuses existing user ---");
    const walkInRes2 = await request(app)
      .post("/api/appointments/walk-in")
      .set("Authorization", `Bearer ${recToken}`)
      .send({
        patient: {
          name: "Walkin Patient One Updated",
          phone: "9900112233", // Same phone
        },
        doctorId: doctorProfile._id.toString(),
        reason: "Follow-up checkup",
      });

    console.log("Second walk-in response code:", walkInRes2.status);
    console.log("Second walk-in patient ID:", walkInRes2.body.appointment?.patient?._id);
    console.log("Second walk-in queueNumber:", walkInRes2.body.appointment?.queueNumber);

    if (
      walkInRes2.status !== 201 ||
      walkInRes2.body.appointment?.patient?._id !== walkInRes1.body.appointment?.patient?._id ||
      walkInRes2.body.appointment?.queueNumber !== 2
    ) {
      throw new Error("Test 2 Failed: Did not reuse existing user by phone or queueNumber not incremented");
    }
    const totalUsersWithPhone = await User.countDocuments({ phone: "9900112233" });
    if (totalUsersWithPhone !== 1) {
      throw new Error("Test 2 Failed: Duplicate user document created for same phone!");
    }
    console.log("✓ Test 2 Passed: Existing patient resolved by phone, atomic queueNumber 2 assigned, no duplicate user created.");

    console.log("\n--- Test 3: Check-in scheduled appointment (confirmed -> in-queue) ---");
    const scheduledAppt = await Appointment.create({
      patient: walkInRes1.body.appointment.patient._id,
      doctor: doctorProfile._id,
      department: dept._id,
      appointmentDate: new Date(),
      slotStart: new Date(),
      status: "confirmed",
      reason: "Routine review",
    });

    const checkInRes = await request(app)
      .patch(`/api/appointments/${scheduledAppt._id}/check-in`)
      .set("Authorization", `Bearer ${recToken}`)
      .send();

    console.log("Check-in response code:", checkInRes.status);
    console.log("Check-in new status:", checkInRes.body.appointment?.status);
    console.log("Check-in checkInTime:", checkInRes.body.appointment?.checkInTime);

    if (
      checkInRes.status !== 200 ||
      checkInRes.body.appointment?.status !== "in-queue" ||
      !checkInRes.body.appointment?.checkInTime
    ) {
      throw new Error("Test 3 Failed: Check-in failed or checkInTime not set");
    }
    console.log("✓ Test 3 Passed: Confirmed appointment transitioned to in-queue with checkInTime recorded.");

    console.log("\n--- Test 4: Doctor consultation lifecycle (in-queue -> in-consultation -> completed) ---");
    const apptId = walkInRes1.body.appointment._id;

    // Doctor starts consultation
    const startRes = await request(app)
      .patch(`/api/appointments/${apptId}/start-consultation`)
      .set("Authorization", `Bearer ${docToken}`)
      .send();

    console.log("Start consultation code:", startRes.status);
    console.log("Status:", startRes.body.appointment?.status);
    console.log("consultationStartTime:", startRes.body.appointment?.consultationStartTime);

    if (
      startRes.status !== 200 ||
      startRes.body.appointment?.status !== "in-consultation" ||
      !startRes.body.appointment?.consultationStartTime
    ) {
      throw new Error("Test 4a Failed: Start consultation failed");
    }

    // Direct completion via old status endpoint must be rejected
    const illegalCompleteRes = await request(app)
      .patch(`/api/appointments/${apptId}/status`)
      .set("Authorization", `Bearer ${docToken}`)
      .send({ status: "completed" });

    console.log("Old status route 'completed' rejection code:", illegalCompleteRes.status);
    if (illegalCompleteRes.status !== 400) {
      throw new Error("Test 4b Failed: Old status route allowed completion directly!");
    }

    // Doctor ends consultation
    const endRes = await request(app)
      .patch(`/api/appointments/${apptId}/end-consultation`)
      .set("Authorization", `Bearer ${docToken}`)
      .send({ consultationNotes: "Patient prescribed rest and fluids" });

    console.log("End consultation code:", endRes.status);
    console.log("Status:", endRes.body.appointment?.status);
    console.log("consultationEndTime:", endRes.body.appointment?.consultationEndTime);

    if (
      endRes.status !== 200 ||
      endRes.body.appointment?.status !== "completed" ||
      !endRes.body.appointment?.consultationEndTime
    ) {
      throw new Error("Test 4c Failed: End consultation failed");
    }
    console.log("✓ Test 4 Passed: Consultation started and completed strictly via doctor consultation endpoints.");

    console.log("\n=================================");
    console.log("ALL PHASE B2 VERIFICATIONS PASSED!");
    console.log("=================================");
  } finally {
    await mongoose.disconnect();
    await replSet.stop();
  }
}

runB2Tests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
