
const Doctor = require("../models/doctor.model");
const User = require("../models/user.model");
const Department = require("../models/department.model");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const createDoctor = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      specialization,
      qualification,
      experience,
      consultationFee,
      department,
      availableDays,
    } = req.body;

    // 1. Validate required fields
    if (
      !name?.trim() ||
      !email?.trim() ||
      !password ||
      !specialization?.trim() ||
      !qualification?.trim() ||
      experience == null ||
      consultationFee == null ||
      !department
    ) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    if (
      !Number.isFinite(Number(experience)) ||
      Number(experience) < 0 ||
      !Number.isFinite(Number(consultationFee)) ||
      Number(consultationFee) < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Experience and consultation fee must be valid non-negative numbers",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 2. Check duplicate email
    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }

    // 3. Check department exists and is active
    const existingDepartment = await Department.findOne({
      _id: department,
      isActive: true,
    });

    if (!existingDepartment) {
      return res.status(400).json({
        success: false,
        message: "Invalid or inactive department",
      });
    }

    // 4. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5. Create User account
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      phone,
      role: "doctor",
    });

    try {
      // 6. Create Doctor profile
      const doctor = await Doctor.create({
        userId: user._id,
        specialization: specialization.trim(),
        qualification: qualification.trim(),
        experience: Number(experience),
        consultationFee: Number(consultationFee),
        department: existingDepartment._id,
        availableDays: availableDays || [],
      });

      return res.status(201).json({
        success: true,
        message: "Doctor created successfully",
        doctor: {
          _id: doctor._id,
          userId: user._id,
          name: user.name,
          email: user.email,
          specialization: doctor.specialization,
          qualification: doctor.qualification,
          experience: doctor.experience,
          consultationFee: doctor.consultationFee,
          department: doctor.department,
          availableDays: doctor.availableDays,
        },
      });
    } catch (error) {
      // Remove User if Doctor profile creation fails
      await User.findByIdAndDelete(user._id);
      throw error;
    }
  } catch (error) {
    console.error("Create doctor error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A record with this unique value already exists",
      });
    }

    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid doctor data",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
const getDoctors = async (req, res) => {
  try {
    const { specialization, department } = req.query;

    const filter = {};

    if (specialization) {
      filter.specialization = specialization;
    }

    if (department) {
      if (!mongoose.isValidObjectId(department)) {
        return res.status(400).json({
          success: false,
          message: "Invalid department ID",
        });
      }

      filter.department = department;
    }

    const doctors = await Doctor.find(filter)
      .populate("userId", "name email phone")
      .populate("department", "name");

    return res.status(200).json({
      success: true,
      message: "Doctors fetched successfully",
      count: doctors.length,
      doctors,
    });
  } catch (error) {
    console.error("Get doctors error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


const getDoctorsById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid doctor ID",
      });
    }

    const doctor = await Doctor.findById(id)
      .populate("userId", "name email phone")
      .populate("department", "name");

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Doctor fetched successfully",
      doctor,
    });
  } catch (error) {
    console.error("Get doctor by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};



const updateDoctor = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid doctor ID",
      });
    }

    const allowedFields = [
      "specialization",
      "qualification",
      "experience",
      "consultationFee",
      "department",
      "availableDays",
      "availableTime",
      "isAvailable",
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

    if (updates.department !== undefined) {
      if (!mongoose.isValidObjectId(updates.department)) {
        return res.status(400).json({
          success: false,
          message: "Invalid department ID",
        });
      }

      const department = await Department.findOne({
        _id: updates.department,
        isActive: true,
      });

      if (!department) {
        return res.status(400).json({
          success: false,
          message: "Invalid or inactive department",
        });
      }
    }

    const doctor = await Doctor.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate("userId", "name email phone")
      .populate("department", "name");

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Doctor updated successfully",
      doctor,
    });
  } catch (error) {
    console.error("Update doctor error:", error);

    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid doctor data",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = { createDoctor, getDoctors, getDoctorsById, updateDoctor };
