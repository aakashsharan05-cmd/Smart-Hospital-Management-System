const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/auth.middleware");
const { authorizeRoles } = require("../middleware/role.middleware");

const {
  bookAppointment,
} = require("../controllers/appointment.Controller");

router.post(
  "/",
  protect,
  authorizeRoles("patient"),
  bookAppointment
);

module.exports = router;