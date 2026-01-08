require("dotenv").config({ path: '.env.local' });
require("dotenv").config();

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ CRITICAL: Missing required environment variables:', missingEnvVars);
  console.error('Please set these environment variables before starting the server.');
  process.exit(1);
}

module.exports = {
  MONGODB_URI:
    process.env.MONGODB_URI ||
    "mongodb+srv://cacpm_users:cacpm1@cacpm.edyltbr.mongodb.net/?appName=CACPM",
  PORT: process.env.PORT || 5000,
  BASE_URL: process.env.BASE_URL || "https://daily-report-backend.onrender.com",
  JWT_SECRET: process.env.JWT_SECRET, // REQUIRED - no fallback for security
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "1h", // Reduced from 7d to 1h
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET + "_refresh",
  REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",
  EMAIL_HOST: process.env.EMAIL_HOST || "smtp.gmail.com",
  EMAIL_PORT: process.env.EMAIL_PORT || 465,
  EMAIL_USER: process.env.EMAIL_USER || "ridagony@gmail.com",
  EMAIL_PASS: process.env.EMAIL_PASS || "aipfhpwdfkymjjqe",
  FRONTEND_URL:
    process.env.FRONTEND_URL ||
    "https://daily-report-frontend-s4tq.onrender.com",
  NODE_ENV: process.env.NODE_ENV || "development", // Default to development for local testing
};

// Security: Don't log sensitive configuration in production
if (process.env.NODE_ENV !== "production") {
  console.log("EMAIL CONFIG CHECK", {
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    user: process.env.EMAIL_USER,
    passExists: !!process.env.EMAIL_PASS,
  });
  console.log("JWT Configuration: Secret set, Expiration:", module.exports.JWT_EXPIRES_IN);
}
VITE_API_URL="http://localhost:5000"