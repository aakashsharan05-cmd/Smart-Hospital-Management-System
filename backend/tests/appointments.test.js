const request = require("supertest");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const User = require("../src/models/user.model");
const Department = require("../src/models/department.model");
const Doctor = require("../src/models/doctor.model");
const Appointment = require("../src/models/appointment.model");
const { setupTestDb, teardownTestDb } = require("./testHelper");

describe("Appointments, Concurrency & Ownership Tests", () => {
  let docUser1, docUser2, doc1, doc2, dept, patientUser, p1Token, doc1Token, doc2Token, recToken;

  beforeAll(async () => {
    await setupTestDb();

    dept = await Department.create({
      name: "General Medicine",
      description: "Primary Care",
      isActive: true,
    });

    const hashedPassword = await bcrypt.hash("Pass123!", 10);

    docUser1 = await User.create({
      name: "Dr. Owner",
      email: "dr.owner@hospital.com",
      password: hashedPassword,
      phone: "+919888800001",
      role: "doctor",
      isActive: true,
    });

    docUser2 = await User.create({
      name: "Dr. Intruder",
      email: "dr.intruder@hospital.com",
      password: hashedPassword,
      phone: "+919888800002",
      role: "doctor",
      isActive: true,
    });

    doc1 = await Doctor.create({
      userId: docUser1._id,
      department: dept._id,
      specialization: "General Physician",
      qualification: "MBBS",
      consultationFee: 40,
      experience: 8,
      availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      availableTime: { start: "00:00", end: "23:59" },
      isAvailable: true,
    });

    doc2 = await Doctor.create({
      userId: docUser2._id,
      department: dept._id,
      specialization: "General Physician",
      qualification: "MBBS",
      consultationFee: 40,
      experience: 5,
      availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      availableTime: { start: "00:00", end: "23:59" },
      isAvailable: true,
    });

    patientUser = await User.create({
      name: "Patient Sam",
      email: "sam@hospital.com",
      password: hashedPassword,
      phone: "+919888800003",
      role: "patient",
      isActive: true,
    });

    p1Token = jwt.sign(
      { userId: patientUser._id.toString(), role: "patient" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    doc1Token = jwt.sign(
      { userId: docUser1._id.toString(), role: "doctor" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    doc2Token = jwt.sign(
      { userId: docUser2._id.toString(), role: "doctor" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const recUser = await User.create({
      name: "Receptionist Jane",
      email: "rec.checkin@hospital.com",
      password: hashedPassword,
      phone: "+919888800099",
      role: "receptionist",
      isActive: true,
    });

    recToken = jwt.sign(
      { userId: recUser._id.toString(), role: "receptionist" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  test("Double-booking: concurrent booking attempts for same doctor and slot -> only one succeeds", async () => {
    const futureSlot = new Date(Date.now() + 2 * 24 * 3600 * 1000);
    futureSlot.setMinutes(0, 0, 0);

    const bookingPayload = {
      doctorId: doc1._id.toString(),
      appointmentDate: futureSlot.toISOString(),
      reason: "General Checkup",
    };

    // Attempt two simultaneous bookings for the same doctor and slot
    const [res1, res2] = await Promise.all([
      request(app)
        .post("/api/appointments")
        .set("Authorization", `Bearer ${p1Token}`)
        .send(bookingPayload),
      request(app)
        .post("/api/appointments")
        .set("Authorization", `Bearer ${p1Token}`)
        .send(bookingPayload),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 409]);
  });

  test("Doctor ownership check: doctor cannot start consultation for another doctor's patient", async () => {
    const futureSlot = new Date(Date.now() + 3 * 24 * 3600 * 1000);
    futureSlot.setMinutes(30, 0, 0);

    const appt = await Appointment.create({
      patient: patientUser._id,
      doctor: doc1._id,
      department: dept._id,
      appointmentDate: futureSlot,
      slotStart: futureSlot,
      status: "in-queue",
      reason: "Routine visit",
      queueNumber: 1,
    });

    // Dr. Intruder (doc2) attempts to start consultation on doc1's appointment
    const res = await request(app)
      .patch(`/api/appointments/${appt._id}/start-consultation`)
      .set("Authorization", `Bearer ${doc2Token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);

    // Dr. Owner (doc1) starts consultation successfully
    const resOwner = await request(app)
      .patch(`/api/appointments/${appt._id}/start-consultation`)
      .set("Authorization", `Bearer ${doc1Token}`);

    expect(resOwner.status).toBe(200);
    expect(resOwner.body.appointment.status).toBe("in-consultation");
  });

  test("Legal and illegal status transitions", async () => {
    const futureSlot = new Date(Date.now() + 4 * 24 * 3600 * 1000);
    futureSlot.setMinutes(0, 0, 0);

    const appt = await Appointment.create({
      patient: patientUser._id,
      doctor: doc1._id,
      department: dept._id,
      appointmentDate: futureSlot,
      slotStart: futureSlot,
      status: "pending",
      reason: "Fever",
      queueNumber: 2,
    });

    // Illegal: pending directly to in-consultation
    const resIllegal = await request(app)
      .patch(`/api/appointments/${appt._id}/start-consultation`)
      .set("Authorization", `Bearer ${doc1Token}`);
    expect(resIllegal.status).toBe(400);

    // Legal: pending -> confirmed via PATCH /api/appointments/:id/status
    const resConfirm = await request(app)
      .patch(`/api/appointments/${appt._id}/status`)
      .set("Authorization", `Bearer ${doc1Token}`)
      .send({ status: "confirmed" });
    expect(resConfirm.status).toBe(200);
    expect(resConfirm.body.appointment.status).toBe("confirmed");
  });

  test("Check-in allowed only if appointmentDate is today in Asia/Kolkata", async () => {
    // 1. Appointment scheduled for tomorrow
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
    const futureAppt = await Appointment.create({
      patient: patientUser._id,
      doctor: doc1._id,
      department: dept._id,
      appointmentDate: tomorrow,
      slotStart: tomorrow,
      status: "confirmed",
      reason: "Tomorrow Checkup",
      queueNumber: 3,
    });

    // Check-in on tomorrow's appointment fails with 400
    const resFuture = await request(app)
      .patch(`/api/appointments/${futureAppt._id}/check-in`)
      .set("Authorization", `Bearer ${recToken}`);

    expect(resFuture.status).toBe(400);
    expect(resFuture.body.message).toMatch(/only allowed on the scheduled appointment date/i);

    // 2. Appointment scheduled for today in Asia/Kolkata
    const today = new Date();
    const todayAppt = await Appointment.create({
      patient: patientUser._id,
      doctor: doc1._id,
      department: dept._id,
      appointmentDate: today,
      slotStart: today,
      status: "confirmed",
      reason: "Today Checkup",
      queueNumber: 4,
    });

    // Check-in on today's appointment succeeds with 200 and sets status to in-queue
    const resToday = await request(app)
      .patch(`/api/appointments/${todayAppt._id}/check-in`)
      .set("Authorization", `Bearer ${recToken}`);

    expect(resToday.status).toBe(200);
    expect(resToday.body.appointment.status).toBe("in-queue");
    expect(resToday.body.appointment.checkInTime).toBeDefined();
  });

  test("PATCH /api/appointments/:id/mark-missed transitions confirmed|in-queue -> missed, rejects completed, enforces role", async () => {
    // 1. confirmed -> missed
    const apptConfirmed = await Appointment.create({
      patient: patientUser._id,
      doctor: doc1._id,
      department: dept._id,
      appointmentDate: new Date(),
      status: "confirmed",
      reason: "No show checkup",
      queueNumber: 11,
    });

    const resConfirmedMissed = await request(app)
      .patch(`/api/appointments/${apptConfirmed._id}/mark-missed`)
      .set("Authorization", `Bearer ${recToken}`);

    expect(resConfirmedMissed.status).toBe(200);
    expect(resConfirmedMissed.body.appointment.status).toBe("missed");

    // 2. in-queue -> missed
    const apptInQueue = await Appointment.create({
      patient: patientUser._id,
      doctor: doc1._id,
      department: dept._id,
      appointmentDate: new Date(),
      status: "in-queue",
      reason: "Left waiting room",
      queueNumber: 12,
    });

    const resQueueMissed = await request(app)
      .patch(`/api/appointments/${apptInQueue._id}/mark-missed`)
      .set("Authorization", `Bearer ${recToken}`);

    expect(resQueueMissed.status).toBe(200);
    expect(resQueueMissed.body.appointment.status).toBe("missed");

    // 3. completed -> missed (illegal transition, rejected with 400)
    const apptCompleted = await Appointment.create({
      patient: patientUser._id,
      doctor: doc1._id,
      department: dept._id,
      appointmentDate: new Date(),
      status: "completed",
      reason: "Done appointment",
      queueNumber: 13,
    });

    const resCompletedMissed = await request(app)
      .patch(`/api/appointments/${apptCompleted._id}/mark-missed`)
      .set("Authorization", `Bearer ${recToken}`);

    expect(resCompletedMissed.status).toBe(400);

    // 4. Role enforcement: patient role cannot mark missed (rejected with 403)
    const resForbidden = await request(app)
      .patch(`/api/appointments/${apptInQueue._id}/mark-missed`)
      .set("Authorization", `Bearer ${p1Token}`);

    expect(resForbidden.status).toBe(403);
  });
});
