const mongoose = require("mongoose");

const pharmacySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Medicine name is required"],
      trim: true,
    },

    genericName: {
      type: String,
      trim: true,
      default: "",
    },

    manufacturer: {
      type: String,
      trim: true,
      default: "",
    },

    category: {
      type: String,
      trim: true,
      default: "General",
    },

    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },

    stock: {
      type: Number,
      required: true,
      min: [0, "Stock cannot be negative"],
      default: 0,
    },

    expiryDate: {
      type: Date,
      default: null,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

pharmacySchema.index({ name: 1, manufacturer: 1 });
pharmacySchema.index({ stock: 1 });

const Medicine = mongoose.model("Medicine", pharmacySchema);

module.exports = Medicine;
