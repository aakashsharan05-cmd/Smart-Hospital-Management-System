const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/auth.middleware");
const { authorizeRoles } = require("../middleware/role.middleware");

const {
  getProfile,
  updateProfile,
  getAllUsers,
  toggleUserActive,
} = require("../controllers/user.Controller");

// Own profile
router.get("/profile", protect, getProfile);
router.patch("/profile", protect, updateProfile);

// Admin: list all users
router.get("/", protect, authorizeRoles("admin"), getAllUsers);

// Admin: toggle user active
router.patch(
  "/:id/toggle-active",
  protect,
  authorizeRoles("admin"),
  toggleUserActive
);

module.exports = router;
