const express = require("express");

const { createDepartment } = require("../controllers/department.Controller");
const { protect } = require("../middleware/auth.middleware");
const { authorizeRoles } = require("../middleware/role.middleware");

const router = express.Router();

router.post(
  "/",
  protect,
  authorizeRoles("admin"),
  createDepartment
);

module.exports = router;