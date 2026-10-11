const Appointment = require("../models/appontment.model");
const mongoose = require("mongoose");
const Doctor = require("../models/doctor.model");

const bookAppointment = async (req, res) => {
    try {
        const { doctorId, appointmentDate, reason } = req.body


        if (
            !doctorId ||
            !appointmentDate ||
            typeof reason !== "string" ||
            !reason.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Required fields are mandatory",
            });
        }


        if (!mongoose.isValidObjectId(doctorId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid department ID",
            });
        }

        const doctor = await Doctor.findById(doctorId);

        if (!doctor) {
            return res.status(400).json({
                success: false,
                message: "Doctor does not exist",
            });
        }

        const date = new Date(appointmentDate);

        if (isNaN(date.getTime())) {
            return res.status(400).json({
                success: false,
                message: "Invalid appointment date",
            });
        }

        if (date <= new Date()) {
            return res.status(400).json({
                success: false,
                message: "Appointment date must be in the future",
            });
        }
        const existingAppointment = await Appointment.findOne({
            doctor: doctor._id,
            appointmentDate: date,
            status: { $nin: ["cancelled", "rejected"] },
        });

        if (existingAppointment) {
            return res.status(409).json({
                success: false,
                message: "Doctor already has an appointment at this time",
            });
        }

        const appointment = await Appointment.create({
            patient: req.user.userId,
            doctor: doctor._id,
            department: doctor.department,
            appointmentDate: date,
            reason: reason.trim()
        });

        return res.status(200).json({
            sucess: true,
            appointment
        });

    } catch (error) {
        return res.status(500).json({
            message: "Server error",
            error: error.message,
        });
    }
};

module.exports = { bookAppointment };