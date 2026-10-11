const express = require("express");

const { protect } = require("../middleware/auth.middleware");
const { authorizeRoles } = require("../middleware/role.middleware");
const {
  createDepartment,
  getDepartments,
} = require("../controllers/department.Controller");

const router = express.Router();


router.post(
  "/",
  protect,
  authorizeRoles("admin"),
  createDepartment
);

router.get("/", protect, getDepartments);

module.exports = router;