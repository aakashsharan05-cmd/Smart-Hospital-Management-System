const Department = require("../models/department.model");
const mongoose = require("mongoose");

const createDepartment = async (req, res) => {
  try {
    const { name, description, location } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Department name is required",
      });
    }

    const dname = name.trim();

    const department = await Department.create({
      name: dname,
      description,
      location,
    });

    return res.status(201).json({
      success: true,
      message: "Department created successfully",
      department: {
        _id: department._id,
        name: department.name,
        description: department.description,
        location: department.location,
        isActive: department.isActive,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Department already exists",
      });
    }

    console.error("Create department error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getDepartments = async (req, res) => {
  try {
    // Admin sees all departments (including inactive); others see only active
    const filter =
      req.user && req.user.role === "admin" ? {} : { isActive: true };

    const departments = await Department.find(filter).populate(
      "headDoctor",
      "specialization"
    );

    return res.status(200).json({
      success: true,
      message: "Departments fetched successfully",
      departments,
    });
  } catch (error) {
    console.error("Get departments error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getDepartmentById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid department ID",
      });
    }

    const department = await Department.findById(id).populate(
      "headDoctor",
      "specialization"
    );

    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    return res.status(200).json({
      success: true,
      department,
    });
  } catch (error) {
    console.error("Get department by ID error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid department ID",
      });
    }

    const allowedFields = ["name", "description", "location", "headDoctor"];
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

    if (updates.name !== undefined && !updates.name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Department name cannot be empty",
      });
    }

    if (
      updates.headDoctor !== undefined &&
      updates.headDoctor !== null &&
      !mongoose.isValidObjectId(updates.headDoctor)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid head doctor ID",
      });
    }

    const department = await Department.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Department updated successfully",
      department,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A department with this name already exists",
      });
    }

    console.error("Update department error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const toggleDepartmentActive = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid department ID",
      });
    }

    const department = await Department.findById(id);
    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    department.isActive = !department.isActive;
    await department.save();

    return res.status(200).json({
      success: true,
      message: `Department ${department.isActive ? "activated" : "deactivated"} successfully`,
      department,
    });
  } catch (error) {
    console.error("Toggle department error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createDepartment,
  getDepartments,
  getDepartmentById,
  updateDepartment,
  toggleDepartmentActive,
};