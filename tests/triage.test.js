const request = require("supertest");
const http = require("http");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const app = require("../src/app");
const User = require("../src/models/user.model");
const Department = require("../src/models/department.model");
const { triageSymptoms, MANDATORY_DISCLAIMER } = require("../src/services/triage.service");
const { setupTestDb, teardownTestDb } = require("./testHelper");

describe("AI Symptom Triage, Privacy & Fallback Tests", () => {
  let mockServer, patientToken, lastRequestBody, responseOverride, delayMs;

  beforeAll(async () => {
    await setupTestDb();

    // Seed departments: Cardiology (active), InactiveDept (inactive), General Medicine (active)
    await Department.create({
      name: "Cardiology",
      description: "Heart",
      isActive: true,
    });
    await Department.create({
      name: "Inactive Specialty",
      description: "Inactive",
      isActive: false,
    });
    await Department.create({
      name: "General Medicine",
      description: "Primary",
      isActive: true,
    });

    const hashedPassword = await bcrypt.hash("Pass123!", 10);
    const patientUser = await User.create({
      name: "Triage Patient",
      email: "triage.patient@hospital.com",
      password: hashedPassword,
      phone: "+919555500001",
      role: "patient",
      isActive: true,
    });

    patientToken = jwt.sign(
      { userId: patientUser._id.toString(), role: "patient" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    mockServer = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          lastRequestBody = JSON.parse(body);
        } catch (e) {
          lastRequestBody = body;
        }

        setTimeout(() => {
          if (responseOverride) {
            res.writeHead(responseOverride.statusCode || 200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(responseOverride.data));
          } else {
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
        }, delayMs || 0);
      });
    });

    await new Promise((r) => mockServer.listen(0, r));
    const port = mockServer.address().port;
    const mockBase = `http://127.0.0.1:${port}`;

    const originalFetch = global.fetch;
    global.fetch = async (url, opts) => {
      if (typeof url === "string" && url.includes("generativelanguage.googleapis.com")) {
        const redirected = url.replace(
          /https:\/\/generativelanguage\.googleapis\.com[^\?]*/,
          `${mockBase}/models/gemini-1.5-flash:generateContent`
        );
        return originalFetch(redirected, opts);
      }
      return originalFetch(url, opts);
    };

    process.env.GEMINI_API_KEY = "test-fake-key";
    process.env.GEMINI_MODEL = "gemini-1.5-flash";
  });

  afterAll(async () => {
    if (mockServer) mockServer.close();
    await teardownTestDb();
  });

  test("Privacy: only symptom text sent to Gemini, zero PII, and only active departments passed", async () => {
    lastRequestBody = null;
    const triage = await triageSymptoms("Severe chest heaviness");
    expect(triage.disclaimer).toBe(MANDATORY_DISCLAIMER);

    const prompt = lastRequestBody?.contents?.[0]?.parts?.[0]?.text || "";
    expect(prompt).not.toContain("Triage Patient");
    expect(prompt).not.toContain("triage.patient@hospital.com");
    expect(prompt).not.toContain("+919555500001");

    // Only active departments in prompt
    expect(prompt).toContain("Cardiology");
    expect(prompt).toContain("General Medicine");
    expect(prompt).not.toContain("Inactive Specialty");
  });

  test("Fallback when Gemini returns invalid or inactive department", async () => {
    responseOverride = {
      statusCode: 200,
      data: {
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify({ suggestedDepartment: "Inactive Specialty", urgency: "low" }) }],
            },
          },
        ],
      },
    };

    const triage = await triageSymptoms("Skin rash");
    expect(triage.suggestedDepartment).not.toBe("Inactive Specialty");
    expect(["Cardiology", "General Medicine"]).toContain(triage.suggestedDepartment);
    responseOverride = null;
  });

  test("Rate limiter rejects 11th request within 1 minute with 429", async () => {
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post("/api/appointments/triage")
        .set("Authorization", `Bearer ${patientToken}`)
        .send({ symptomText: `Triage check ${i}` });
    }

    const res11 = await request(app)
      .post("/api/appointments/triage")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ symptomText: "Excessive request" });

    expect(res11.status).toBe(429);
  });
});
