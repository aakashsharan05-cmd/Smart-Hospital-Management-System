const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/auth.middleware");
const { authorizeRoles } = require("../middleware/role.middleware");

const {
  addMedicine,
  getMedicines,
  getMedicineById,
  updateMedicine,
  getLowStockMedicines,
} = require("../controllers/pharmacy.Controller");

// Low stock alert — must be before /:id to avoid route conflict
router.get(
  "/low-stock",
  protect,
  authorizeRoles("admin", "receptionist"),
  getLowStockMedicines
);

// List all medicines (any authenticated user)
router.get("/", protect, getMedicines);

// Admin adds medicine
router.post("/", protect, authorizeRoles("admin"), addMedicine);

// Get single medicine
router.get("/:id", protect, getMedicineById);

// Admin updates medicine
router.patch("/:id", protect, authorizeRoles("admin"), updateMedicine);

module.exports = router;
