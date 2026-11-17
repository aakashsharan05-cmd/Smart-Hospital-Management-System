/**
 * Wait-Time Prediction Service (Canonical Module)
 *
 * Implements wait time prediction using the external Python ML service with a 1.5s timeout,
 * and a heuristic fallback formula:
 *   predictedWait = 5 + queueLength * Number(process.env.DEFAULT_CONSULT_MIN || 8)
 *
 * Exposes computeWaitTime and updateQueueWaitEstimates.
 */

const {
  computeWaitTime,
  updateQueueWaitEstimates,
} = require("./waitPrediction.service");

module.exports = {
  computeWaitTime,
  updateQueueWaitEstimates,
};
