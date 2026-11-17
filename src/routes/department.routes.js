const express = require("express");

const { protect } = require("../middleware/auth.middleware");
const { authorizeRoles } = require("../middleware/role.middleware");
const {
  createDepartment,
  getDepartments,
  getDepartmentById,
  updateDepartment,
  toggleDepartmentActive,
} = require("../controllers/department.Controller");

const router = express.Router();

// Admin creates department
router.post("/", protect, authorizeRoles("admin"), createDepartment);

// Any authenticated user can list departments
router.get("/", protect, getDepartments);

// Any authenticated user can view a department
router.get("/:id", protect, getDepartmentById);

// Admin updates department
router.patch("/:id", protect, authorizeRoles("admin"), updateDepartment);

// Admin toggles department active/inactive
router.patch(
  "/:id/toggle",
  protect,
  authorizeRoles("admin"),
  toggleDepartmentActive
);

module.exports = router;