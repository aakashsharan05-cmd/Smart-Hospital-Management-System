require("dotenv").config();

// Validate required environment variables at startup
const validateEnv = () => {
  const missing = [];

  if (!process.env.MONGOURL || !process.env.MONGOURL.trim()) {
    missing.push("MONGOURL");
  }

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length < 32) {
    missing.push("JWT_SECRET (must be at least 32 characters long)");
  }

  if (!process.env.CORS_ORIGIN || !process.env.CORS_ORIGIN.trim()) {
    missing.push("CORS_ORIGIN");
  }

  if (missing.length > 0) {
    console.error("FATAL: Missing or invalid required environment variables:");
    missing.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  }
};

validateEnv();

const app = require("./src/app");
const connectDB = require("./src/db/db");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
