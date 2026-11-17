const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

/**
 * JWT authentication middleware.
 *
 * WHY we load the user from DB on every request instead of trusting the JWT
 * payload alone: if an admin deactivates a user (sets isActive=false), the
 * old token must stop working immediately. JWT payloads are immutable once
 * signed, so the only way to enforce real-time deactivation is a DB check.
 *
 * Performance note: we select only _id, role, isActive (covered by the
 * default index) so this adds ~1-2 ms per request on Atlas, which is
 * acceptable for a hospital system handling hundreds—not millions—of RPM.
 */
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is required",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Load fresh user state from DB
    const user = await User.findById(decoded.userId).select(
      "_id role isActive"
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User no longer exists",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account has been deactivated",
      });
    }

    // Downstream controllers use req.user.userId (string) and req.user.role
    req.user = {
      userId: user._id.toString(),
      role: user.role,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

module.exports = { protect };
