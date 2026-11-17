const Billing = require("../models/billing.model");
const Appointment = require("../models/appointment.model");
const Doctor = require("../models/doctor.model");
const Prescription = require("../models/prescription.model");
const Medicine = require("../models/pharmacy.model");
const mongoose = require("mongoose");
const { getNextInvoiceNumber } = require("../utils/counter");

// ── Create bill for a completed appointment (Transaction) ─
const createBill = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const {
      appointmentId,
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

    // Verify appointment exists and populate doctor info
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

    // Requirement: only allow createBill when appointment.status === "completed"
    if (appointment.status !== "completed") {
      return res.status(400).json({
        success: false,
        message: `Bills can only be created for completed appointments (current status: '${appointment.status}')`,
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

    // Requirement: take consultationFee ONLY from Doctor document, never from client
    const fee = appointment.doctor?.consultationFee ?? 0;

    // Requirement: Compute medicineCharges server-side from prescription's medicines
    let computedMedicineCharges = 0;
    const prescription = await Prescription.findOne({
      appointment: appointmentId,
    });

    if (prescription && prescription.medicines && prescription.medicines.length > 0) {
      for (const item of prescription.medicines) {
        if (!item.name) continue;
        const medDoc = await Medicine.findOne({
          name: { $regex: new RegExp(`^${item.name.trim()}$`, "i") },
          isActive: true,
        });
        if (medDoc) {
          const parsedDuration = parseInt(item.duration, 10);
          const qty = !isNaN(parsedDuration) && parsedDuration > 0 ? parsedDuration : 1;
          computedMedicineCharges += medDoc.price * qty;
        }
      }
    }

    const finalMedicineCharges =
      computedMedicineCharges > 0
        ? computedMedicineCharges
        : Number(medicineCharges) || 0;

    const othCharges = Number(otherCharges) || 0;
    const disc = Number(discount) || 0;

    if (othCharges < 0 || disc < 0 || finalMedicineCharges < 0) {
      return res.status(400).json({
        success: false,
        message: "Charges and discount must be non-negative numbers",
      });
    }

    // Requirement: Cap discount so it cannot exceed total charges before discount
    const subtotal = fee + finalMedicineCharges + othCharges;
    if (disc > subtotal) {
      return res.status(400).json({
        success: false,
        message: `Discount (₹${disc}) cannot exceed total charges before discount (₹${subtotal})`,
      });
    }

    const totalAmount = subtotal - disc;

    let createdBill;
    await session.withTransaction(async () => {
      // Collision-safe invoice number via atomic counter
      const invoiceNumber = await getNextInvoiceNumber(new Date(), session);

      const [bill] = await Billing.create(
        [
          {
            appointment: appointmentId,
            patient: appointment.patient,
            doctor: appointment.doctor._id || appointment.doctor,
            consultationFee: fee,
            medicineCharges: finalMedicineCharges,
            otherCharges: othCharges,
            discount: disc,
            totalAmount,
            paymentMethod: paymentMethod || "other",
            invoiceNumber,
          },
        ],
        { session }
      );

      createdBill = bill;
    });

    const populated = await Billing.findById(createdBill._id)
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
      message: error.message || "Server error while creating bill",
    });
  } finally {
    await session.endSession();
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

// ── Mark bill as paid + deduct pharmacy stock (Transaction)
const markBillPaid = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid bill ID",
      });
    }

    let updatedBill;
    await session.withTransaction(async () => {
      const bill = await Billing.findById(id).session(session);
      if (!bill) {
        const err = new Error("Bill not found");
        err.statusCode = 404;
        throw err;
      }

      if (bill.paymentStatus === "paid") {
        const err = new Error("Bill is already marked as paid");
        err.statusCode = 400;
        throw err;
      }

      // Requirement: Deduct pharmacy stock for prescribed medicines using transaction
      const prescription = await Prescription.findOne({
        appointment: bill.appointment,
      }).session(session);

      if (prescription && prescription.medicines && prescription.medicines.length > 0) {
        for (const item of prescription.medicines) {
          if (!item.name) continue;
          const parsedDuration = parseInt(item.duration, 10);
          const qty = !isNaN(parsedDuration) && parsedDuration > 0 ? parsedDuration : 1;

          const medDoc = await Medicine.findOne({
            name: { $regex: new RegExp(`^${item.name.trim()}$`, "i") },
          }).session(session);

          if (medDoc) {
            if (medDoc.stock < qty) {
              const err = new Error(
                `Insufficient pharmacy stock for medicine '${medDoc.name}'. In stock: ${medDoc.stock}, required: ${qty}`
              );
              err.statusCode = 400;
              throw err;
            }
            medDoc.stock -= qty;
            await medDoc.save({ session });
          }
        }
      }

      const { paymentMethod } = req.body;
      bill.paymentStatus = "paid";
      bill.paidAt = new Date();
      if (paymentMethod) {
        bill.paymentMethod = paymentMethod;
      }
      await bill.save({ session });
      updatedBill = bill;
    });

    return res.status(200).json({
      success: true,
      message: "Bill marked as paid and pharmacy inventory updated",
      bill: updatedBill,
    });
  } catch (error) {
    console.error("Mark bill paid error:", error.message);
    const statusCode = error.statusCode || 400;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to process bill payment",
    });
  } finally {
    await session.endSession();
  }
};

module.exports = {
  createBill,
  getMyBills,
  getAllBills,
  getBillById,
  markBillPaid,
};
