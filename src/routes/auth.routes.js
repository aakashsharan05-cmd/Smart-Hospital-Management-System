const express = require("express");

const {
  registerUser,
  loginUser,
} = require("../controllers/auth.Controller");
const { protect } = require("../middleware/auth.middleware");
const User = require("../models/user.model");

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);

// Get current authenticated user's info
router.get("/me", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error("Get me error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

module.exports = router;
