
const mongoose = require("mongoose");

const billingSchema = new mongoose.Schema(
  {
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
      unique: true,
    },

    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },

    consultationFee: {
      type: Number,
      required: true,
      min: 0,
    },

    medicineCharges: {
      type: Number,
      default: 0,
      min: 0,
    },

    otherCharges: {
      type: Number,
      default: 0,
      min: 0,
    },

    discount: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },

    paymentMethod: {
      type: String,
      enum: ["cash", "card", "upi", "online", "other"],
      default: "other",
    },

    paidAt: {
      type: Date,
      default: null,
    },

    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

billingSchema.index({ patient: 1, createdAt: -1 });

const Billing = mongoose.model("Billing", billingSchema);

module.exports = Billing;
