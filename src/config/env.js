// src/config/config.js
require("dotenv").config(); // load .env

module.exports = {
  MONGODB_URI:
    process.env.MONGODB_URI ||
    "mongodb+srv://cacpm_users:cacpm1@cacpm.edyltbr.mongodb.net/?appName=CACPM",
  PORT: process.env.PORT || 5000,
  BASE_URL: process.env.BASE_URL || "https://daily-report-backend.onrender.com",
  JWT_SECRET:
    process.env.JWT_SECRET ||
    "8127619f1382cb5f434127e02f344c7d0a9620dc492f6c34cfe8d5f7f320d53cdefe84ef7d84f9186df9cf0f995b46c91feb66140aa5f0d2bda40ee7c05ee12e",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  JWT_RESET_SECRET:
    process.env.JWT_RESET_SECRET ||
    "9f8e7d6c5b4a3210fedcba9876543210abcdef1234567890fedcba9876543210",
  JWT_RESET_EXPIRES_IN: process.env.JWT_RESET_EXPIRES_IN || "10m",
  EMAIL_HOST: process.env.EMAIL_HOST || "cambodiacpm.com",
  EMAIL_PORT: process.env.EMAIL_PORT || 465,
  EMAIL_USER: process.env.EMAIL_USER || "noreply@cambodiacpm.com",
  EMAIL_PASS: process.env.EMAIL_PASS || "83tB.5Hk@2LP",
  EMAIL_FROM: process.env.EMAIL_FROM || "noreply@cambodiacpm.com",
  SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || "noreply@cambodiacpm.com",
  FRONTEND_URL:
    process.env.FRONTEND_URL ||
    "http://localhost:8080",
  PRODUCTION_URL: process.env.PRODUCTION_URL || "https://daily-report-frontend-s4tq.onrender.com",
};

// ✅ Use module.exports directly, no need to require db.js
console.log("EMAIL CONFIG CHECK", {
  host: process.env.EMAIL_HOST || "cambodiacpm.com",
  port: process.env.EMAIL_PORT || 465,
  user: process.env.EMAIL_USER || "noreply@cambodiacpm.com",
  passExists: !!process.env.EMAIL_PASS,
  from: process.env.EMAIL_FROM || "noreply@cambodiacpm.com",
});

console.log("FRONTEND URL being used:", process.env.FRONTEND_URL || "http://localhost:8080");
