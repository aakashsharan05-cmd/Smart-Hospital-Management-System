const request = require("supertest");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const User = require("../src/models/user.model");
const Department = require("../src/models/department.model");
const Doctor = require("../src/models/doctor.model");
const Appointment = require("../src/models/appointment.model");
const Billing = require("../src/models/billing.model");
const { setupTestDb, teardownTestDb } = require("./testHelper");

describe("Billing Rules & Transaction Tests", () => {
  let staffToken, doctor, patientUser, completedAppt, inQueueAppt;

  beforeAll(async () => {
    await setupTestDb();

    const dept = await Department.create({
      name: "Dermatology",
      description: "Skin Clinic",
      isActive: true,
    });

    const hashedPassword = await bcrypt.hash("Pass123!", 10);

    const docUser = await User.create({
      name: "Dr. Skin",
      email: "dr.skin@hospital.com",
      password: hashedPassword,
      phone: "+919444400001",
      role: "doctor",
      isActive: true,
    });

    doctor = await Doctor.create({
      userId: docUser._id,
      department: dept._id,
      specialization: "Dermatologist",
      qualification: "MD Derm",
      consultationFee: 45,
      experience: 8,
      isAvailable: true,
    });

    patientUser = await User.create({
      name: "Patient Billing Test",
      email: "billing.patient@hospital.com",
      password: hashedPassword,
      phone: "+919444400002",
      role: "patient",
      isActive: true,
    });

    const staffUser = await User.create({
      name: "Billing Admin",
      email: "billing.admin@hospital.com",
      password: hashedPassword,
      phone: "+919444400003",
      role: "admin",
      isActive: true,
    });

    staffToken = jwt.sign(
      { userId: staffUser._id.toString(), role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const today = new Date();
    const later = new Date(Date.now() + 3600000);

    completedAppt = await Appointment.create({
      patient: patientUser._id,
      doctor: doctor._id,
      department: dept._id,
      appointmentDate: today,
      slotStart: today,
      status: "completed",
      consultationStartTime: today,
      consultationEndTime: today,
      reason: "Skin allergy",
      queueNumber: 1,
    });

    inQueueAppt = await Appointment.create({
      patient: patientUser._id,
      doctor: doctor._id,
      department: dept._id,
      appointmentDate: later,
      slotStart: later,
      status: "in-queue",
      reason: "Acne",
      queueNumber: 2,
    });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  test("Billing rejection: cannot generate bill for incomplete appointments", async () => {
    const res = await request(app)
      .post("/api/billing")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        appointmentId: inQueueAppt._id.toString(),
        medicineCharges: 0,
        otherCharges: 0,
        discount: 0,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/only be created for completed appointments/i);
  });

  test("Billing creation: successfully creates bill for completed appointment with atomic invoiceNumber", async () => {
    const res = await request(app)
      .post("/api/billing")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        appointmentId: completedAppt._id.toString(),
        medicineCharges: 20,
        otherCharges: 10,
        discount: 5,
        paymentMethod: "cash",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.bill).toBeDefined();
    expect(res.body.bill.invoiceNumber).toMatch(/^INV-/);
    expect(res.body.bill.totalAmount).toBe(70); // 45 (fee) + 20 + 10 - 5
  });
});
