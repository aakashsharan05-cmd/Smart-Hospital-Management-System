require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const connectDB = require("../src/db/db");
const User = require("../src/models/user.model");

const createAdmin = async () => {
  try {
  
    const name = process.env.ADMIN_NAME;
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    const phone = process.env.ADMIN_PHONE;

    if (!name || !email || !password) {
      throw new Error(
        "ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD are required in .env"
      );
    }

    if (password.length < 8) {
      throw new Error("Admin password must be at least 8 characters long");
    }

   
    await connectDB();

   
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      throw new Error(
        "A user with this email already exists. Use a different email."
      );
    }


    const hashedPassword = await bcrypt.hash(password, 10);


    const adminData = {
      name,
      email,
      password: hashedPassword,
      role: "admin",
    };

    if (phone) {
      adminData.phone = phone;
    }

    const admin = await User.create(adminData);

    
  } catch (error) {
    console.error("Admin creation failed:", error.message);
    process.exitCode = 1;
  } finally {
    
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  }
};

createAdmin();