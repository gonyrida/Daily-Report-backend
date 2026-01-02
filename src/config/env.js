require("dotenv").config();

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
  EMAIL_HOST: process.env.EMAIL_HOST || "smtp.gmail.com",
  EMAIL_PORT: process.env.EMAIL_PORT || 465,
  EMAIL_USER: process.env.EMAIL_USER || "ridagony@gmail.com",
  EMAIL_PASS: process.env.EMAIL_PASS || "aipfhpwdfkymjjqe",
  FRONTEND_URL:
    process.env.FRONTEND_URL ||
    "https://daily-report-frontend-s4tq.onrender.com",
};
console.log("EMAIL CONFIG CHECK", {
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  user: process.env.EMAIL_USER,
  passExists: !!process.env.EMAIL_PASS,
});
