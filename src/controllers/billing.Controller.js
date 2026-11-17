const Billing = require("../models/billing.model");
const Appointment = require("../models/appointment.model");
const Doctor = require("../models/doctor.model");
const mongoose = require("mongoose");

// Generate a unique invoice number: INV-YYYYMMDD-XXXX
const generateInvoiceNumber = async () => {
  const today = new Date();
  const dateStr =
    today.getFullYear().toString() +
    String(today.getMonth() + 1).padStart(2, "0") +
    String(today.getDate()).padStart(2, "0");

  const prefix = `INV-${dateStr}-`;

  // Find the last invoice for today to increment
  const lastBill = await Billing.findOne({
    invoiceNumber: { $regex: `^${prefix}` },
  }).sort({ invoiceNumber: -1 });

  let seq = 1;
  if (lastBill) {
    const lastSeq = parseInt(lastBill.invoiceNumber.split("-")[2], 10);
    if (!isNaN(lastSeq)) {
      seq = lastSeq + 1;
    }
  }

  return `${prefix}${String(seq).padStart(4, "0")}`;
};

// ── Create bill for a completed appointment ───────────────
const createBill = async (req, res) => {
  try {
    const {
      appointmentId,
      consultationFee,
      medicineCharges,
      otherCharges,
      discount,
      paymentMethod,
    } = req.body;

    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        message: "appointmentId is required",
      });
    }

    if (!mongoose.isValidObjectId(appointmentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment ID",
      });
    }

    // Verify appointment exists
    const appointment = await Appointment.findById(appointmentId).populate(
      "doctor",
      "consultationFee"
    );

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // Check if bill already exists for this appointment
    const existingBill = await Billing.findOne({ appointment: appointmentId });
    if (existingBill) {
      return res.status(409).json({
        success: false,
        message: "A bill already exists for this appointment",
      });
    }

    // Use provided consultation fee or fall back to doctor's default
    const fee =
      consultationFee != null
        ? Number(consultationFee)
        : appointment.doctor?.consultationFee || 0;

    const medCharges = Number(medicineCharges) || 0;
    const othCharges = Number(otherCharges) || 0;
    const disc = Number(discount) || 0;

    if (fee < 0 || medCharges < 0 || othCharges < 0 || disc < 0) {
      return res.status(400).json({
        success: false,
        message: "Charges and discount must be non-negative",
      });
    }

    const totalAmount = fee + medCharges + othCharges - disc;

    const invoiceNumber = await generateInvoiceNumber();

    const bill = await Billing.create({
      appointment: appointmentId,
      patient: appointment.patient,
      doctor: appointment.doctor._id || appointment.doctor,
      consultationFee: fee,
      medicineCharges: medCharges,
      otherCharges: othCharges,
      discount: disc,
      totalAmount: Math.max(totalAmount, 0),
      paymentMethod: paymentMethod || "other",
      invoiceNumber,
    });

    const populated = await Billing.findById(bill._id)
      .populate("patient", "name email phone")
      .populate({
        path: "doctor",
        select: "specialization userId",
        populate: { path: "userId", select: "name" },
      })
      .populate("appointment", "appointmentDate reason");

    return res.status(201).json({
      success: true,
      message: "Bill created successfully",
      bill: populated,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A bill already exists for this appointment",
      });
    }

    console.error("Create bill error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ── Patient views own bills ───────────────────────────────
const getMyBills = async (req, res) => {
  try {
    const bills = await Billing.find({ patient: req.user.userId })
      .populate({
        path: "doctor",
        select: "specialization userId",
        populate: { path: "userId", select: "name" },
      })
      .populate("appointment", "appointmentDate reason")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      bills,
    });
  } catch (error) {
    console.error("Get my bills error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ── Admin/Receptionist list all bills ─────────────────────
const getAllBills = async (req, res) => {
  try {
    const { paymentStatus } = req.query;
    const filter = {};

    if (
      paymentStatus &&
      ["pending", "paid", "failed", "refunded"].includes(paymentStatus)
    ) {
      filter.paymentStatus = paymentStatus;
    }

    const bills = await Billing.find(filter)
      .populate("patient", "name email phone")
      .populate({
        path: "doctor",
        select: "specialization userId",
        populate: { path: "userId", select: "name" },
      })
      .populate("appointment", "appointmentDate reason")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      bills,
    });
  } catch (error) {
    console.error("Get all bills error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ── Get single bill by ID ─────────────────────────────────
const getBillById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid bill ID",
      });
    }

    const bill = await Billing.findById(id)
      .populate("patient", "name email phone")
      .populate({
        path: "doctor",
        select: "specialization userId",
        populate: { path: "userId", select: "name" },
      })
      .populate("appointment", "appointmentDate reason");

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Bill not found",
      });
    }

    // Patient can only see own bills
    if (
      req.user.role === "patient" &&
      bill.patient._id.toString() !== req.user.userId
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    return res.status(200).json({
      success: true,
      bill,
    });
  } catch (error) {
    console.error("Get bill error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ── Mark bill as paid ─────────────────────────────────────
const markBillPaid = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid bill ID",
      });
    }

    const bill = await Billing.findById(id);
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Bill not found",
      });
    }

    if (bill.paymentStatus === "paid") {
      return res.status(400).json({
        success: false,
        message: "Bill is already marked as paid",
      });
    }

    const { paymentMethod } = req.body;

    bill.paymentStatus = "paid";
    bill.paidAt = new Date();
    if (paymentMethod) {
      bill.paymentMethod = paymentMethod;
    }
    await bill.save();

    return res.status(200).json({
      success: true,
      message: "Bill marked as paid",
      bill,
    });
  } catch (error) {
    console.error("Mark bill paid error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports = {
  createBill,
  getMyBills,
  getAllBills,
  getBillById,
  markBillPaid,
};
