const rateLimit = require("express-rate-limit");

/**
 * Rate limiter for AI symptom triage:
 * 10 requests per minute per IP / user
 */
const triageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req) => {
    return req.user?.userId || req.ip;
  },
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: "Too many triage requests. Please wait a minute before trying again.",
    });
  },
});

module.exports = {
  triageLimiter,
};
