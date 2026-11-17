const http = require("http");
const { computeWaitTime, computeBatchWaitTimes } = require("../src/services/waitPrediction.service");

describe("Wait-Time Prediction & Timeout Tests", () => {
  test("Fallback formula correctly computes 5 + queueLength * DEFAULT_CONSULT_MIN", async () => {
    delete process.env.ML_SERVICE_URL;
    process.env.DEFAULT_CONSULT_MIN = "8";

    const res0 = await computeWaitTime({ queueLength: 0 });
    expect(res0.predictedWaitMinutes).toBe(5);
    expect(res0.waitPredictionSource).toBe("fallback-formula");

    const res3 = await computeWaitTime({ queueLength: 3 });
    expect(res3.predictedWaitMinutes).toBe(29);
    expect(res3.waitPredictionSource).toBe("fallback-formula");
  });

  test("1.5s timeout abort controller triggers and smoothly falls back to formula", async () => {
    // Create a server that deliberately delays for 2500ms
    let timerId;
    const slowServer = http.createServer((req, res) => {
      timerId = setTimeout(() => {
        try {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ predicted_wait_minutes: 99 }));
        } catch {
          // Ignore
        }
      }, 2500);
    });

    await new Promise((r) => slowServer.listen(0, r));
    const port = slowServer.address().port;
    process.env.ML_SERVICE_URL = `http://127.0.0.1:${port}`;

    const start = Date.now();
    const result = await computeWaitTime({ queueLength: 2 });
    const elapsed = Date.now() - start;

    clearTimeout(timerId);
    if (slowServer.closeAllConnections) slowServer.closeAllConnections();
    await new Promise((r) => slowServer.close(r));
    delete process.env.ML_SERVICE_URL;

    expect(elapsed).toBeLessThan(2000); // Must abort at ~1500ms
    expect(result.predictedWaitMinutes).toBe(21); // 5 + 2*8
    expect(result.waitPredictionSource).toBe("fallback-formula");
  });

  test("Honest uncertainty: dynamic typical_error_minutes from ML service and heuristic MAE fallback without hardcoding 2.4 or 5", async () => {
    // 1. ML service returns explicit typical_error_minutes (e.g. 3.7) -> must use it directly
    const customErrorServer = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        predicted_wait_minutes: 25,
        typical_error_minutes: 3.7,
      }));
    });

    await new Promise((r) => customErrorServer.listen(0, r));
    const port = customErrorServer.address().port;
    process.env.ML_SERVICE_URL = `http://127.0.0.1:${port}`;

    const resCustom = await computeWaitTime({ queueLength: 3 });
    if (customErrorServer.closeAllConnections) customErrorServer.closeAllConnections();
    await new Promise((r) => customErrorServer.close(r));
    delete process.env.ML_SERVICE_URL;

    expect(resCustom.predictedWaitMinutes).toBe(25);
    expect(resCustom.typicalErrorMinutes).toBe(3.7);
    expect(resCustom.waitPredictionSource).toBe("ml-model");

    // 2. ML service returns no typical_error_minutes -> must NOT hardcode 2.4, should be null
    const noErrorServer = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        predicted_wait_minutes: 18,
      }));
    });

    await new Promise((r) => noErrorServer.listen(0, r));
    const portNoErr = noErrorServer.address().port;
    process.env.ML_SERVICE_URL = `http://127.0.0.1:${portNoErr}`;

    const resNoErr = await computeWaitTime({ queueLength: 2 });
    if (noErrorServer.closeAllConnections) noErrorServer.closeAllConnections();
    await new Promise((r) => noErrorServer.close(r));
    delete process.env.ML_SERVICE_URL;

    expect(resNoErr.predictedWaitMinutes).toBe(18);
    expect(resNoErr.typicalErrorMinutes).toBeNull();

    // 3. Fallback formula uses heuristic baseline from metrics.json (~12.2 min) rather than hardcoded 5.0
    const fallbackRes = await computeWaitTime({ queueLength: 1 });
    expect(fallbackRes.waitPredictionSource).toBe("fallback-formula");
    expect(fallbackRes.typicalErrorMinutes).toBe(12.2);
  });

  test("Batch wait prediction computes all queue positions in single batch call", async () => {
    let batchCallCount = 0;
    const batchServer = http.createServer((req, res) => {
      if (req.url === "/predict-batch" && req.method === "POST") {
        batchCallCount++;
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", () => {
          const parsed = JSON.parse(body);
          const predictions = parsed.items.map((it) => ({
            predicted_wait_minutes: it.queue_length * 15 + 5,
            typical_error_minutes: 2.1,
          }));
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ predictions }));
        });
      }
    });

    await new Promise((r) => batchServer.listen(0, r));
    const port = batchServer.address().port;
    process.env.ML_SERVICE_URL = `http://127.0.0.1:${port}`;

    const items = [
      { queueLength: 0, departmentName: "Cardiology", doctorExperience: 10 },
      { queueLength: 1, departmentName: "Cardiology", doctorExperience: 10 },
      { queueLength: 2, departmentName: "Cardiology", doctorExperience: 10 },
    ];

    const results = await computeBatchWaitTimes(items);
    if (batchServer.closeAllConnections) batchServer.closeAllConnections();
    await new Promise((r) => batchServer.close(r));
    delete process.env.ML_SERVICE_URL;

    expect(batchCallCount).toBe(1); // Exactly one batch call for all items
    expect(results.length).toBe(3);
    expect(results[0].predictedWaitMinutes).toBe(5);
    expect(results[1].predictedWaitMinutes).toBe(20);
    expect(results[2].predictedWaitMinutes).toBe(35);
    expect(results[0].waitPredictionSource).toBe("ml-model");
  });

  afterAll(async () => {
    await new Promise((r) => setTimeout(r, 100));
  });
});
