
const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
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

    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },

    appointmentDate: {
      type: Date,
      required: [true, "Appointment date is required"],
    },

    reason: {
      type: String,
      required: [true, "Reason for appointment is required"],
      trim: true,
      maxlength: 500,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "cancelled",
        "completed",
        "rejected",
      ],
      default: "pending",
    },

    queueNumber: {
      type: Number,
      min: 1,
    },

    notes: {
      type: String,
      trim: true,
      default: "",
    },

    cancellationReason: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

appointmentSchema.index({
  doctor: 1,
  appointmentDate: 1,
});

appointmentSchema.index({
  patient: 1,
  appointmentDate: -1,
});

const Appointment = mongoose.model(
  "Appointment",
  appointmentSchema
);

module.exports = Appointment;
