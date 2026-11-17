const Medicine = require("../models/pharmacy.model");
const mongoose = require("mongoose");

// ── Add new medicine ──────────────────────────────────────
const addMedicine = async (req, res) => {
  try {
    const {
      name,
      genericName,
      manufacturer,
      category,
      price,
      stock,
      expiryDate,
      description,
    } = req.body;

    if (!name?.trim() || price == null) {
      return res.status(400).json({
        success: false,
        message: "Medicine name and price are required",
      });
    }

    if (Number(price) < 0 || (stock != null && Number(stock) < 0)) {
      return res.status(400).json({
        success: false,
        message: "Price and stock must be non-negative",
      });
    }

    let parsedExpiry = null;
    if (expiryDate) {
      parsedExpiry = new Date(expiryDate);
      if (isNaN(parsedExpiry.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid expiry date",
        });
      }
    }

    const medicine = await Medicine.create({
      name: name.trim(),
      genericName: genericName?.trim() || "",
      manufacturer: manufacturer?.trim() || "",
      category: category?.trim() || "General",
      price: Number(price),
      stock: stock != null ? Number(stock) : 0,
      expiryDate: parsedExpiry,
      description: description?.trim() || "",
    });

    return res.status(201).json({
      success: true,
      message: "Medicine added successfully",
      medicine,
    });
  } catch (error) {
    console.error("Add medicine error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ── List all medicines ────────────────────────────────────
const getMedicines = async (req, res) => {
  try {
    const { category, search } = req.query;
    const filter = {};

    if (category) {
      filter.category = category;
    }

    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    const medicines = await Medicine.find(filter).sort({ name: 1 });

    return res.status(200).json({
      success: true,
      medicines,
    });
  } catch (error) {
    console.error("Get medicines error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ── Get single medicine ───────────────────────────────────
const getMedicineById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid medicine ID",
      });
    }

    const medicine = await Medicine.findById(id);
    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: "Medicine not found",
      });
    }

    return res.status(200).json({
      success: true,
      medicine,
    });
  } catch (error) {
    console.error("Get medicine error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ── Update medicine ───────────────────────────────────────
const updateMedicine = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid medicine ID",
      });
    }

    const allowedFields = [
      "name",
      "genericName",
      "manufacturer",
      "category",
      "price",
      "stock",
      "expiryDate",
      "description",
      "isActive",
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update",
      });
    }

    // Validate numbers
    if (updates.price !== undefined && Number(updates.price) < 0) {
      return res.status(400).json({
        success: false,
        message: "Price must be non-negative",
      });
    }

    if (updates.stock !== undefined && Number(updates.stock) < 0) {
      return res.status(400).json({
        success: false,
        message: "Stock must be non-negative",
      });
    }

    const medicine = await Medicine.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: "Medicine not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Medicine updated successfully",
      medicine,
    });
  } catch (error) {
    console.error("Update medicine error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ── Get low stock medicines (stock < threshold) ───────────
const getLowStockMedicines = async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold, 10) || 10;

    const medicines = await Medicine.find({
      stock: { $lt: threshold },
      isActive: true,
    }).sort({ stock: 1 });

    return res.status(200).json({
      success: true,
      threshold,
      medicines,
    });
  } catch (error) {
    console.error("Get low stock error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports = {
  addMedicine,
  getMedicines,
  getMedicineById,
  updateMedicine,
  getLowStockMedicines,
};
