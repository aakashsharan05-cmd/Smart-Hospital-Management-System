const Department = require("../models/department.model");

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

        console.error("Create department error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

const getDepartments = async (req, res) => {
  try {
    const departments = await Department.find({
      isActive: true,
    });

    return res.status(200).json({
      success: true,
      message: "Departments fetched successfully",
      departments,
    });
  } catch (error) {
  

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = { createDepartment, getDepartments };