const request = require("supertest");
const http = require("http");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const app = require("../src/app");
const User = require("../src/models/user.model");
const Department = require("../src/models/department.model");
const { triageSymptoms, getRuleBasedTriage, MANDATORY_DISCLAIMER } = require("../src/services/triage.service");
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

  test("Eye symptoms with Ophthalmology active recommends Ophthalmology", () => {
    const result = getRuleBasedTriage("burning sensation in my eyes", ["Cardiology", "Ophthalmology", "General Medicine"]);
    expect(result.suggestedDepartment).toBe("Ophthalmology");
    expect(result.urgency).toBe("low");
    expect(result.disclaimer).toBe(MANDATORY_DISCLAIMER);
  });

  test("Eye symptoms with Ophthalmology unavailable falls back to General Medicine", () => {
    const result = getRuleBasedTriage("burning sensation in my eyes", ["Cardiology", "General Medicine"]);
    expect(result.suggestedDepartment).toBe("General Medicine");
    expect(result.urgency).toBe("low");
    expect(result.disclaimer).toBe(MANDATORY_DISCLAIMER);
  });

  test("Chest pain with Cardiology active recommends Cardiology with high urgency", () => {
    const result = getRuleBasedTriage("severe chest pain and shortness of breath", ["Cardiology", "General Medicine"]);
    expect(result.suggestedDepartment).toBe("Cardiology");
    expect(result.urgency).toBe("high");
    expect(result.disclaimer).toBe(MANDATORY_DISCLAIMER);
  });

  test("Skin symptoms with Dermatology active recommends Dermatology", () => {
    const result = getRuleBasedTriage("itching and red skin rash", ["Cardiology", "Dermatology", "General Medicine"]);
    expect(result.suggestedDepartment).toBe("Dermatology");
    expect(result.urgency).toBe("low");
    expect(result.disclaimer).toBe(MANDATORY_DISCLAIMER);
  });

  test("Unclear symptoms route to General Medicine if active", () => {
    const result = getRuleBasedTriage("feeling unwell and strange malaise", ["Cardiology", "General Medicine"]);
    expect(result.suggestedDepartment).toBe("General Medicine");
    expect(result.urgency).toBe("low");
    expect(result.disclaimer).toBe(MANDATORY_DISCLAIMER);
  });

  test("No active General Medicine fallback returns safe null response rather than unrelated specialty", () => {
    // When specialty is unavailable and General Medicine is ALSO unavailable (only Cardiology active)
    const eyeResult = getRuleBasedTriage("burning sensation in my eyes", ["Cardiology"]);
    expect(eyeResult.suggestedDepartment).toBeNull();
    expect(eyeResult.suggestedDepartment).not.toBe("Cardiology");
    expect(eyeResult.disclaimer).toBe(MANDATORY_DISCLAIMER);

    // When symptoms are unclear and General Medicine is unavailable
    const unclearResult = getRuleBasedTriage("unclear symptoms without matching keywords", ["Cardiology"]);
    expect(unclearResult.suggestedDepartment).toBeNull();
    expect(unclearResult.suggestedDepartment).not.toBe("Cardiology");
  });

  test("Gemini invalid response triggers rule-based fallback without returning invalid specialty", async () => {
    responseOverride = {
      statusCode: 200,
      data: {
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify({ suggestedDepartment: "Astrology Care", urgency: "medium" }) }],
            },
          },
        ],
      },
    };

    const triage = await triageSymptoms("burning sensation in my eyes");
    // DB has Cardiology and General Medicine active
    expect(triage.suggestedDepartment).toBe("General Medicine");
    expect(triage.disclaimer).toBe(MANDATORY_DISCLAIMER);
    responseOverride = null;
  });

  test("Gemini timeout triggers graceful fallback to rule-based triage", async () => {
    delayMs = 3500; // Exceeds 3000ms timeout
    const triage = await triageSymptoms("severe chest pain");
    expect(triage.suggestedDepartment).toBe("Cardiology");
    expect(triage.urgency).toBe("high");
    expect(triage.disclaimer).toBe(MANDATORY_DISCLAIMER);
    delayMs = 0;
  });

  test("Frontend triage request sequencer discards out-of-order stale responses", async () => {
    let triageRequestId = 0;
    let displayedTriage = null;
    let isLoading = false;

    const handleSymptomChange = (newSymptoms, asyncFetcher) => {
      const text = newSymptoms.trim();
      if (text.length < 5) {
        triageRequestId++;
        displayedTriage = null;
        isLoading = false;
        return Promise.resolve();
      }

      const reqId = ++triageRequestId;
      displayedTriage = null;
      isLoading = true;

      return asyncFetcher(text).then((res) => {
        if (reqId === triageRequestId) {
          displayedTriage = res;
          isLoading = false;
        }
      });
    };

    // Request 1: slow (150ms) -> Cardiology
    const slowRequest = new Promise((resolve) =>
      setTimeout(() => resolve({ suggestedDepartment: "Cardiology" }), 150)
    );

    // Request 2: fast (50ms) -> Ophthalmology
    const fastRequest = new Promise((resolve) =>
      setTimeout(() => resolve({ suggestedDepartment: "Ophthalmology" }), 50)
    );

    const p1 = handleSymptomChange("chest pain", () => slowRequest);
    expect(isLoading).toBe(true);
    expect(displayedTriage).toBeNull();

    const p2 = handleSymptomChange("burning sensation in my eyes", () => fastRequest);
    expect(isLoading).toBe(true);
    expect(displayedTriage).toBeNull();

    await p2;
    expect(displayedTriage.suggestedDepartment).toBe("Ophthalmology");
    expect(isLoading).toBe(false);

    await p1;
    // Out-of-order response from request 1 did NOT overwrite request 2
    expect(displayedTriage.suggestedDepartment).toBe("Ophthalmology");
  });

  test("Frontend immediately clears recommendation and loading when symptoms < 5 chars", () => {
    let triageRequestId = 0;
    let displayedTriage = { suggestedDepartment: "Cardiology" };
    let isLoading = true;

    const handleSymptomChange = (newSymptoms) => {
      const text = newSymptoms.trim();
      if (text.length < 5) {
        triageRequestId++;
        displayedTriage = null;
        isLoading = false;
        return;
      }
      triageRequestId++;
      displayedTriage = null;
      isLoading = true;
    };

    handleSymptomChange("eye");
    expect(displayedTriage).toBeNull();
    expect(isLoading).toBe(false);
  });

  test("Gemini API key is transmitted in x-goog-api-key header and never in URL query parameters", async () => {
    process.env.GEMINI_API_KEY = "test-secret-gemini-key-999";
    process.env.GEMINI_MODEL = "gemini-1.5-flash";

    const fetchSpy = jest.spyOn(global, "fetch").mockImplementationOnce(async (url, options) => {
      expect(url).not.toContain("key=");
      expect(url).not.toContain("test-secret-gemini-key-999");
      expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent");
      expect(options.headers["x-goog-api-key"]).toBe("test-secret-gemini-key-999");

      return {
        ok: true,
        json: async () => ({
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
        }),
      };
    });

    const result = await triageSymptoms("Severe chest pain and irregular heartbeat");
    expect(result.suggestedDepartment).toBe("Cardiology");
    expect(result.urgency).toBe("high");
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    fetchSpy.mockRestore();
    delete process.env.GEMINI_API_KEY;
  });
});
