const http = require("http");
const { computeWaitTime } = require("../src/services/waitPrediction.service");

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
    const slowServer = http.createServer((req, res) => {
      setTimeout(() => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ predicted_wait_minutes: 99 }));
      }, 2500);
    });

    await new Promise((r) => slowServer.listen(0, r));
    const port = slowServer.address().port;
    process.env.ML_SERVICE_URL = `http://127.0.0.1:${port}`;

    const start = Date.now();
    const result = await computeWaitTime({ queueLength: 2 });
    const elapsed = Date.now() - start;

    slowServer.close();
    delete process.env.ML_SERVICE_URL;

    expect(elapsed).toBeLessThan(2000); // Must abort at ~1500ms
    expect(result.predictedWaitMinutes).toBe(21); // 5 + 2*8
    expect(result.waitPredictionSource).toBe("fallback-formula");
  });
});
