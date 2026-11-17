
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

    slotStart: {
      type: Date,
      required: [true, "Slot start is required"],
    },

    isSlotActive: {
      type: Boolean,
      default: true,
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

appointmentSchema.pre("validate", function (next) {
  if (this.appointmentDate && !this.slotStart) {
    const d = new Date(this.appointmentDate);
    const mins = d.getMinutes() < 30 ? 0 : 30;
    d.setMinutes(mins, 0, 0);
    this.slotStart = d;
  }
  next();
});

appointmentSchema.pre("save", function (next) {
  if (this.isModified("status") || this.isNew) {
    this.isSlotActive = !["cancelled", "rejected"].includes(this.status);
  }
  next();
});

// Unique partial index: prevent double-booking for the same doctor at the same 30-min slot
// Applies only when status is not cancelled or rejected (isSlotActive === true)
appointmentSchema.index(
  {
    doctor: 1,
    slotStart: 1,
  },
  {
    unique: true,
    partialFilterExpression: { isSlotActive: true },
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
