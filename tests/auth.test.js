const request = require("supertest");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const User = require("../src/models/user.model");
const { setupTestDb, teardownTestDb } = require("./testHelper");

describe("Auth & Role Authorization Integration Tests", () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  test("Deactivated user login must be rejected with 403", async () => {
    const password = "Password123!";
    const hashedPassword = await bcrypt.hash(password, 10);
    const deactivatedUser = await User.create({
      name: "Inactive User",
      email: "inactive@hospital.com",
      password: hashedPassword,
      phone: "+919999900001",
      role: "patient",
      isActive: false,
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "inactive@hospital.com", password });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/deactivated/i);
  });

  test("Deactivated user's existing JWT token must be rejected with 403 on protected routes", async () => {
    const activeUser = await User.create({
      name: "Soon Inactive",
      email: "soon-inactive@hospital.com",
      password: await bcrypt.hash("Pass123!", 10),
      phone: "+919999900002",
      role: "patient",
      isActive: true,
    });

    const token = jwt.sign(
      { userId: activeUser._id.toString(), role: "patient" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Verify token works while active
    const resActive = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(resActive.status).toBe(200);

    // Deactivate user in database
    activeUser.isActive = false;
    await activeUser.save();

    // Verify same token is now rejected with 403
    const resInactive = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(resInactive.status).toBe(403);
    expect(resInactive.body.message).toMatch(/deactivated/i);
  });

  test("Role-based authorization rejects unauthorized roles", async () => {
    const patientUser = await User.create({
      name: "Patient Auth Test",
      email: "patient.authtest@hospital.com",
      password: await bcrypt.hash("Pass123!", 10),
      phone: "+919999900003",
      role: "patient",
      isActive: true,
    });

    const patientToken = jwt.sign(
      { userId: patientUser._id.toString(), role: "patient" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Patient attempting to access admin-only endpoint (e.g. GET /api/users)
    const res = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${patientToken}`);
    expect(res.status).toBe(403);
  });
});
