const request = require("supertest");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const User = require("../src/models/user.model");
const Department = require("../src/models/department.model");
const Doctor = require("../src/models/doctor.model");
const Appointment = require("../src/models/appointment.model");
const { setupTestDb, teardownTestDb } = require("./testHelper");

describe("Walk-in Registration & Deduplication Tests", () => {
  let staffToken, doctor;

  beforeAll(async () => {
    await setupTestDb();

    const dept = await Department.create({
      name: "Pediatrics",
      description: "Child care",
      isActive: true,
    });

    const hashedPassword = await bcrypt.hash("Pass123!", 10);

    const docUser = await User.create({
      name: "Dr. Kids",
      email: "dr.kids@hospital.com",
      password: hashedPassword,
      phone: "+919777700001",
      role: "doctor",
      isActive: true,
    });

    doctor = await Doctor.create({
      userId: docUser._id,
      department: dept._id,
      specialization: "Pediatrician",
      qualification: "MD Pediatrics",
      consultationFee: 35,
      experience: 10,
      availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      availableTime: { start: "00:00", end: "23:59" },
      isAvailable: true,
    });

    const staffUser = await User.create({
      name: "Frontdesk Receptionist",
      email: "reception@hospital.com",
      password: hashedPassword,
      phone: "+919777700002",
      role: "receptionist",
      isActive: true,
    });

    staffToken = jwt.sign(
      { userId: staffUser._id.toString(), role: "receptionist" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  test("Walk-in creation with new patient deduplicates on subsequent visit by phone", async () => {
    const phone = "+919555512345";

    // 1st visit: new walk-in patient without email
    const res1 = await request(app)
      .post("/api/appointments/walk-in")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        doctorId: doctor._id.toString(),
        patient: { name: "Walk-in John", phone },
        reason: "Ear ache",
      });

    expect(res1.status).toBe(201);
    expect(res1.body.success).toBe(true);
    expect(res1.body.appointment.appointmentType).toBe("walk-in");
    expect(res1.body.appointment.status).toBe("in-queue");

    const createdUserId = res1.body.appointment.patient._id || res1.body.appointment.patient;
    const createdUser = await User.findById(createdUserId);
    expect(createdUser.phone).toBe(phone);
    expect(createdUser.email).toMatch(/walkin-.*@hospital\.local/);

    // 2nd visit: walk-in with the EXACT SAME phone number -> must NOT create a duplicate user!
    const res2 = await request(app)
      .post("/api/appointments/walk-in")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        doctorId: doctor._id.toString(),
        patient: { name: "Walk-in John Updated", phone },
        reason: "Follow up",
      });

    expect(res2.status).toBe(201);
    const secondUserId = res2.body.appointment.patient._id || res2.body.appointment.patient;
    expect(secondUserId.toString()).toBe(createdUserId.toString());

    // Verify user count with this phone is strictly 1
    const matchingUsers = await User.find({ phone });
    expect(matchingUsers.length).toBe(1);
  });

  test("Walk-in requires resolved user role to be 'patient'", async () => {
    // 1. Attempt walk-in with a patientId belonging to a doctor user -> 400
    const doctorUserId = doctor.userId;
    const resId = await request(app)
      .post("/api/appointments/walk-in")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        doctorId: doctor._id.toString(),
        patientId: doctorUserId.toString(),
        reason: "Invalid doctor patientId walkin",
      });

    expect(resId.status).toBe(400);
    expect(resId.body.message).toMatch(/not a patient/i);

    // 2. Attempt walk-in with a phone number matching receptionist user -> 400
    const resPhone = await request(app)
      .post("/api/appointments/walk-in")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        doctorId: doctor._id.toString(),
        patient: { name: "Fake Staff Walkin", phone: "+919777700002" },
        reason: "Invalid phone walkin",
      });

    expect(resPhone.status).toBe(400);
    expect(resPhone.body.message).toMatch(/not a patient/i);
  });

  test("Walk-in returns generic message on unexpected 500 error and does not leak internal error.message", async () => {
    jest.spyOn(User, "create").mockImplementationOnce(() => {
      throw new Error("SENSITIVE_INTERNAL_DATABASE_CRASH_DETAILS");
    });

    const res500 = await request(app)
      .post("/api/appointments/walk-in")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        doctorId: doctor._id.toString(),
        patient: { name: "Test 500 Patient", phone: "+919999988888" },
        reason: "Test 500 sanitization",
      });

    expect(res500.status).toBe(500);
    expect(res500.body.success).toBe(false);
    expect(res500.body.message).toBe("Failed to create walk-in appointment");
    expect(res500.body.message).not.toContain("SENSITIVE_INTERNAL_DATABASE");

    User.create.mockRestore();
  });
});
