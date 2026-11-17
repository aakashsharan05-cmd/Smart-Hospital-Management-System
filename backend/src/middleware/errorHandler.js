/**
 * Centralized error-handling middleware.
 *
 * Express 5 automatically catches errors thrown or rejected by async route
 * handlers. This middleware is the final catch-all — it normalizes the
 * response shape so every error the client receives has a consistent format.
 *
 * IMPORTANT: Express identifies error-handling middleware by the 4-parameter
 * signature (err, req, res, next). Do NOT remove the `next` parameter even
 * though it is unused — doing so would turn this into a regular middleware
 * and errors would never arrive here.
 */

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Log for debugging (never log passwords or tokens)
  console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err.message);

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: messages.join(". "),
    });
  }

  // Mongoose cast error (invalid ObjectId, etc.)
  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid ID format",
    });
  }

  // Duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    return res.status(409).json({
      success: false,
      message: `Duplicate value for ${field}`,
    });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }

  // Default: internal server error — don't leak stack traces
  const statusCode = err.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    message:
      statusCode === 500
        ? "Internal server error"
        : err.message || "Something went wrong",
  });
};

module.exports = errorHandler;
