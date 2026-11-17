const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/auth.middleware");
const { authorizeRoles } = require("../middleware/role.middleware");

const {
  createBill,
  getMyBills,
  getAllBills,
  getBillById,
  markBillPaid,
} = require("../controllers/billing.Controller");

// Patient views own bills
router.get("/my", protect, authorizeRoles("patient"), getMyBills);

// Admin / Receptionist lists all bills
router.get("/", protect, authorizeRoles("admin", "receptionist"), getAllBills);

// Admin / Receptionist creates a bill
router.post(
  "/",
  protect,
  authorizeRoles("admin", "receptionist"),
  createBill
);

// Get single bill (access controlled inside)
router.get("/:id", protect, getBillById);

// Mark bill as paid
router.patch(
  "/:id/pay",
  protect,
  authorizeRoles("admin", "receptionist"),
  markBillPaid
);

module.exports = router;
