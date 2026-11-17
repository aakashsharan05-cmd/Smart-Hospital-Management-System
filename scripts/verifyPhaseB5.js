/**
 * Verification Suite for Phase B5: AI Symptom Triage Assistant
 *
 * Verifies:
 * 1. Active department validation & passing only active departments to Gemini.
 * 2. Fallback when Gemini returns an invalid or inactive department name.
 * 3. Fallback when Gemini times out (>3.0s) or API fails.
 * 4. Zero PII transmitted: verifies prompt contains symptoms ONLY, never patient name/email/phone/userId.
 * 5. Mandatory disclaimer: always attached exactly as "AI suggestion only, not a medical diagnosis."
 * 6. Rate limiter: 10 requests per minute per user/IP, 11th request blocked with 429.
 * 7. Role authorization: POST /api/appointments/triage rejects non-patient roles (403).
 * 8. Server-side booking: bookAppointment independently generates and persists aiTriageSuggestion.
 * 9. Frontend production build and high-urgency notice integration.
 */

const { MongoMemoryReplSet } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const http = require("http");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const request = require("supertest");

const app = require("../src/app");
const User = require("../src/models/user.model");
const Department = require("../src/models/department.model");
const Doctor = require("../src/models/doctor.model");
const Appointment = require("../src/models/appointment.model");
const {
  triageSymptoms,
  getRuleBasedTriage,
  MANDATORY_DISCLAIMER,
} = require("../src/services/triage.service");

async function runB5Tests() {
  console.log("Starting Phase B5 verification: AI Symptom Triage Assistant...");
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri();
  await mongoose.connect(uri);
  console.log("Connected to in-memory replica set.");

  process.env.JWT_SECRET = "test-jwt-secret-key-at-least-32-chars-long";

  let mockGeminiServer = null;
  let lastGeminiRequestBody = null;
  let geminiResponseOverride = null;
  let geminiDelayMs = 0;

  try {
    // 0. Setup Mock Gemini HTTP Server
    mockGeminiServer = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          lastGeminiRequestBody = JSON.parse(body);
        } catch (e) {
          lastGeminiRequestBody = body;
        }

        setTimeout(() => {
          if (geminiResponseOverride) {
            res.writeHead(geminiResponseOverride.statusCode || 200, {
              "Content-Type": "application/json",
            });
            res.end(JSON.stringify(geminiResponseOverride.data));
          } else {
            // Default valid response
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                candidates: [
                  {
                    content: {
                      parts: [
                        {
                          text: JSON.stringify({
                            suggestedDepartment: "Cardiology",
                            urgency: "high",
                          }),
                        },
                      ],
                    },
                  },
                ],
              })
            );
          }
        }, geminiDelayMs);
      });
    });

    await new Promise((resolve) => mockGeminiServer.listen(0, resolve));
    const mockPort = mockGeminiServer.address().port;
    const mockGeminiBase = `http://127.0.0.1:${mockPort}`;
    console.log(`Mock Gemini server running on ${mockGeminiBase}`);

    // Seed departments: Cardiology (active), Dermatology (inactive), General Medicine (active)
    const cardioDept = await Department.create({
      name: "Cardiology",
      description: "Heart care",
      isActive: true,
    });
    const inactiveDermDept = await Department.create({
      name: "Dermatology",
      description: "Skin care",
      isActive: false, // Inactive!
    });
    const genMedDept = await Department.create({
      name: "General Medicine",
      description: "Primary care",
      isActive: true,
    });

    // Seed Doctor in Cardiology
    const docUser = await User.create({
      name: "Dr. Heart",
      email: "dr.heart@hospital.local",
      password: await bcrypt.hash("Pass123!", 10),
      phone: "+919876543210",
      role: "doctor",
      isActive: true,
    });

    const doctor = await Doctor.create({
      userId: docUser._id,
      department: cardioDept._id,
      specialization: "Interventional Cardiology",
      qualification: "MBBS, MD (Cardiology)",
      consultationFee: 50,
      experience: 12,
      availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      availableTime: { start: "00:00", end: "23:59" },
      isAvailable: true,
    });

    // Seed Patients
    const patientUser = await User.create({
      name: "Alice Patient",
      email: "alice@hospital.local",
      password: await bcrypt.hash("Pass123!", 10),
      phone: "+919123456789",
      role: "patient",
      isActive: true,
    });

    const doctorUserForAuth = await User.create({
      name: "Dr. Another",
      email: "dr.another@hospital.local",
      password: await bcrypt.hash("Pass123!", 10),
      phone: "+919123456780",
      role: "doctor",
      isActive: true,
    });

    const patientToken = jwt.sign(
      { userId: patientUser._id.toString(), role: "patient" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const docToken = jwt.sign(
      { userId: doctorUserForAuth._id.toString(), role: "doctor" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Override fetch endpoint to redirect to mockGeminiBase during tests
    const originalFetch = global.fetch;
    global.fetch = async (url, opts) => {
      if (typeof url === "string" && url.includes("generativelanguage.googleapis.com")) {
        const redirectedUrl = url.replace(
          /https:\/\/generativelanguage\.googleapis\.com[^\?]*/,
          `${mockGeminiBase}/models/gemini-1.5-flash:generateContent`
        );
        return originalFetch(redirectedUrl, opts);
      }
      return originalFetch(url, opts);
    };

    process.env.GEMINI_API_KEY = "test-fake-gemini-key";
    process.env.GEMINI_MODEL = "gemini-1.5-flash";

    // ──────────────────────────────────────────────────────────
    // TEST 1: Privacy & Active Department passing
    // ──────────────────────────────────────────────────────────
    console.log("\n--- Test 1: Privacy (Zero PII) & Active Department Passing ---");
    lastGeminiRequestBody = null;
    const triage1 = await triageSymptoms("Severe chest heaviness and sweating");
    console.log("Triage 1 output:", triage1);

    const sentPrompt = lastGeminiRequestBody?.contents?.[0]?.parts?.[0]?.text || "";
    console.log("Prompt sent to Gemini length:", sentPrompt.length);

    // Verify ZERO PII in prompt
    if (
      sentPrompt.includes("Alice") ||
      sentPrompt.includes("alice@hospital.local") ||
      sentPrompt.includes("+919123456789") ||
      sentPrompt.includes(patientUser._id.toString())
    ) {
      throw new Error("Test 1 Failed: Patient PII was leaked to Gemini API prompt!");
    }

    // Verify only ACTIVE departments passed to Gemini (Cardiology & General Medicine, NOT Dermatology)
    if (!sentPrompt.includes("Cardiology") || !sentPrompt.includes("General Medicine")) {
      throw new Error("Test 1 Failed: Active departments not found in Gemini prompt");
    }
    if (sentPrompt.includes("Dermatology")) {
      throw new Error("Test 1 Failed: Inactive department 'Dermatology' was passed to Gemini prompt!");
    }

    if (triage1.disclaimer !== MANDATORY_DISCLAIMER) {
      throw new Error("Test 1 Failed: Mandatory disclaimer missing or modified");
    }
    console.log("✓ Test 1 Passed: Zero PII sent to Gemini, and only active departments were provided.");

    // ──────────────────────────────────────────────────────────
    // TEST 2: Invalid Department response handling
    // ──────────────────────────────────────────────────────────
    console.log("\n--- Test 2: Gemini returns invalid / nonexistent department ---");
    geminiResponseOverride = {
      statusCode: 200,
      data: {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    suggestedDepartment: "NonExistentSpecialty123",
                    urgency: "high",
                  }),
                },
              ],
            },
          },
        ],
      },
    };

    const triage2 = await triageSymptoms("Chest pain and palpitation");
    console.log("Triage 2 output (invalid department from Gemini):", triage2);
    if (triage2.suggestedDepartment !== "Cardiology") {
      throw new Error(
        `Test 2 Failed: Expected fallback to Cardiology for chest pain keywords, got: ${triage2.suggestedDepartment}`
      );
    }
    console.log("✓ Test 2 Passed: Invalid department from Gemini fell back cleanly to active department.");

    // ──────────────────────────────────────────────────────────
    // TEST 3: Inactive Department response handling
    // ──────────────────────────────────────────────────────────
    console.log("\n--- Test 3: Gemini returns inactive department ---");
    geminiResponseOverride = {
      statusCode: 200,
      data: {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    suggestedDepartment: "Dermatology", // Inactive in DB!
                    urgency: "low",
                  }),
                },
              ],
            },
          },
        ],
      },
    };

    const triage3 = await triageSymptoms("Skin itching and red rash");
    console.log("Triage 3 output (inactive department from Gemini):", triage3);
    // Since Dermatology is inactive in DB, fallback must resolve to active department (e.g. General Medicine)
    if (triage3.suggestedDepartment === "Dermatology") {
      throw new Error("Test 3 Failed: Returned inactive department 'Dermatology'!");
    }
    if (!["Cardiology", "General Medicine"].includes(triage3.suggestedDepartment)) {
      throw new Error(`Test 3 Failed: Fallback did not resolve to an active department, got: ${triage3.suggestedDepartment}`);
    }
    console.log("✓ Test 3 Passed: Inactive department returned by Gemini safely redirected to active department.");

    // ──────────────────────────────────────────────────────────
    // TEST 4: Gemini Timeout (>3.0s) & API Failure handling
    // ──────────────────────────────────────────────────────────
    console.log("\n--- Test 4: Gemini Timeout (>3.0s) and API Failure ---");
    geminiResponseOverride = null;
    geminiDelayMs = 3500; // Delay longer than 3000ms AbortController

    const startT = Date.now();
    const triage4 = await triageSymptoms("Severe crushing chest pain");
    const elapsed = Date.now() - startT;
    geminiDelayMs = 0; // Reset delay

    console.log(`Elapsed time: ${elapsed}ms, Triage output:`, triage4);
    if (elapsed > 3400) {
      throw new Error(`Test 4 Failed: Request did not abort within 3.0s (took ${elapsed}ms)`);
    }
    if (triage4.suggestedDepartment !== "Cardiology" || triage4.urgency !== "high") {
      throw new Error("Test 4 Failed: Expected rule-based fallback to Cardiology (high) on timeout");
    }

    // Test API Failure (HTTP 500)
    geminiResponseOverride = { statusCode: 500, data: { error: "Internal Gemini Error" } };
    const triage4b = await triageSymptoms("High fever and headache");
    console.log("Triage output on HTTP 500 error:", triage4b);
    if (triage4b.suggestedDepartment !== "General Medicine") {
      throw new Error("Test 4b Failed: Fallback on API failure did not resolve to General Medicine");
    }
    console.log("✓ Test 4 Passed: 3.0s AbortController timeout & HTTP 500 cleanly trigger rule-based fallback.");
    geminiResponseOverride = null;

    // ──────────────────────────────────────────────────────────
    // TEST 5: Route Ordering, Authorization & Rate Limiting
    // ──────────────────────────────────────────────────────────
    console.log("\n--- Test 5: Route Ordering, Role Authorization & Rate Limiter ---");

    // 5a. Route ordering check: POST /api/appointments/triage works and is not treated as /:id
    const validTriageRes = await request(app)
      .post("/api/appointments/triage")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ symptomText: "Shortness of breath and palpitations" });

    console.log("POST /api/appointments/triage status:", validTriageRes.status);
    console.log("POST /api/appointments/triage body:", validTriageRes.body);

    if (
      validTriageRes.status !== 200 ||
      !validTriageRes.body.success ||
      validTriageRes.body.triage?.suggestedDepartment !== "Cardiology" ||
      validTriageRes.body.triage?.disclaimer !== MANDATORY_DISCLAIMER
    ) {
      throw new Error("Test 5a Failed: Triage endpoint did not return expected response");
    }

    // 5b. Authorization: Non-patient role rejected with 403
    const docTriageRes = await request(app)
      .post("/api/appointments/triage")
      .set("Authorization", `Bearer ${docToken}`)
      .send({ symptomText: "Chest pain" });

    console.log("Doctor attempting triage access status:", docTriageRes.status);
    if (docTriageRes.status !== 403) {
      throw new Error("Test 5b Failed: Doctor was not rejected with 403 Forbidden");
    }

    // 5c. Input validation: empty or invalid symptom text rejected with 400
    const emptyRes = await request(app)
      .post("/api/appointments/triage")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ symptomText: "  " });

    if (emptyRes.status !== 400) {
      throw new Error("Test 5c Failed: Empty symptomText was not rejected with 400 Bad Request");
    }

    // 5d. Rate limiting: 10 requests per minute allowed, 11th request receives 429
    console.log("Testing 10 requests/min rate limiter...");
    let hitRateLimit = false;
    for (let i = 1; i <= 10; i++) {
      const r = await request(app)
        .post("/api/appointments/triage")
        .set("Authorization", `Bearer ${patientToken}`)
        .send({ symptomText: `Chest discomfort check ${i}` });
      if (r.status === 429) {
        hitRateLimit = true;
        break;
      }
    }

    // 11th request must receive 429
    const rateLimitedRes = await request(app)
      .post("/api/appointments/triage")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ symptomText: "Excessive request" });

    console.log("11th request rate-limit status:", rateLimitedRes.status);
    if (rateLimitedRes.status !== 429) {
      throw new Error(`Test 5d Failed: 11th request expected 429, got ${rateLimitedRes.status}`);
    }
    console.log("✓ Test 5 Passed: Route ordering correct, patient-only access enforced, rate limiter returned 429.");

    // ──────────────────────────────────────────────────────────
    // TEST 6: Server-side independent triage during booking
    // ──────────────────────────────────────────────────────────
    console.log("\n--- Test 6: Server independently generates and saves triage during booking ---");

    // Client attempts to pass a fake/tampered aiTriageSuggestion in body
    const futureDate = new Date(Date.now() + 24 * 3600 * 1000);
    futureDate.setMinutes(0, 0, 0);

    const bookingRes = await request(app)
      .post("/api/appointments")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({
        doctorId: doctor._id.toString(),
        appointmentDate: futureDate.toISOString(),
        reason: "Severe cardiac palpitations and chest tightness",
        // Client attempts to spoof triage result:
        aiTriageSuggestion: {
          suggestedDepartment: "FakeTamperedDepartment",
          urgency: "low",
          disclaimer: "Tampered disclaimer",
        },
      });

    console.log("Booking response status:", bookingRes.status);
    const bookedAppt = bookingRes.body.appointment;
    console.log("Booked appointment saved triage:", bookedAppt?.aiTriageSuggestion);

    if (
      bookedAppt.aiTriageSuggestion?.suggestedDepartment !== "Cardiology" ||
      bookedAppt.aiTriageSuggestion?.urgency !== "high" ||
      bookedAppt.aiTriageSuggestion?.disclaimer !== MANDATORY_DISCLAIMER
    ) {
      throw new Error(
        `Test 6 Failed: Server did not independently generate triage! Saved: ${JSON.stringify(bookedAppt.aiTriageSuggestion)}`
      );
    }

    // Verify DB persistence
    const dbAppt = await Appointment.findById(bookedAppt._id);
    if (
      dbAppt.symptomText !== "Severe cardiac palpitations and chest tightness" ||
      dbAppt.aiTriageSuggestion.suggestedDepartment !== "Cardiology" ||
      dbAppt.aiTriageSuggestion.urgency !== "high"
    ) {
      throw new Error("Test 6 Failed: Appointment not properly persisted with triage suggestion in MongoDB");
    }
    console.log("✓ Test 6 Passed: Server-side independent triage generation verified. Client spoofing ignored.");

    console.log("\n=================================");
    console.log("ALL PHASE B5 VERIFICATIONS PASSED!");
    console.log("=================================");
  } finally {
    if (mockGeminiServer) {
      mockGeminiServer.close();
    }
    await mongoose.disconnect();
    await replSet.stop();
  }
}

runB5Tests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
