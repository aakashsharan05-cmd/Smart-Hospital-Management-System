const express =require("express")

const { protect } = require("../middleware/auth.middleware");
const { authorizeRoles } = require("../middleware/role.middleware");
const {  createDoctor,
  getDoctors,
  getDoctorsById,
  updateDoctor, } = require("../controllers/doctor.Controller");


const router = express.Router();

router.post(
  "/",
  protect,
  authorizeRoles("admin"),
  createDoctor
);
router.get("/", protect, getDoctors);
router.get("/", protect, getDoctorsById);
router.patch("/", protect, updateDoctor);

module.exports = router;