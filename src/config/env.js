// src/config/config.js
require("dotenv").config(); // load .env
const os = require("os");

// MongoDB URI selection based on hostname
const getMongoDBURI = () => {
  // If explicitly set in environment, use that
  if (process.env.MONGODB_URI) {
    console.log("🔧 Using MONGODB_URI from environment variable");
    return process.env.MONGODB_URI;
  }

  const hostname = os.hostname().toLowerCase();
  console.log(`🖥️  Detected hostname: ${hostname}`);
  
  // Define your machine hostnames here
  const desktopHostnames = ['desktop', 'pc', 'workstation']; // Add your desktop hostname
  const laptopHostnames = ['laptop', 'notebook', 'mbp']; // Add your laptop hostname
  
  // Desktop connection string (multi-host replica set)
  const desktopURI = "mongodb://cacpm_users:cacpm1@ac-0fncxww-shard-00-02.edyltbr.mongodb.net:27017,ac-0fncxww-shard-00-01.edyltbr.mongodb.net:27017,ac-0fncxww-shard-00-00.edyltbr.mongodb.net:27017/test?ssl=true&replicaSet=atlas-jbgmcp-shard-0&authSource=admin";
  
  // Laptop connection string (SRV)
  const laptopURI = "mongodb+srv://cacpm_users:cacpm1@cacpm.edyltbr.mongodb.net/?appName=CACPM";
  
  // Check if hostname contains desktop identifiers
  if (desktopHostnames.some(desktop => hostname.includes(desktop))) {
    console.log(`🖥️  Desktop environment detected (${hostname}), using replica set connection`);
    console.log(`🔗 Using Desktop URI: ${desktopURI.substring(0, 50)}...`);
    return desktopURI;
  }
  
  // Check if hostname contains laptop identifiers
  if (laptopHostnames.some(laptop => hostname.includes(laptop))) {
    console.log(`💻 Laptop environment detected (${hostname}), using SRV connection`);
    console.log(`🔗 Using Laptop URI: ${laptopURI}`);
    return laptopURI;
  }
  
  // Fallback to SRV connection if hostname doesn't match
  console.log(`❓ Unknown environment (${hostname}), using SRV connection as fallback`);
  console.log(`🔗 Using Fallback URI: ${laptopURI}`);
  return laptopURI;
};

module.exports = {
  MONGODB_URI: getMongoDBURI(),
  PORT: process.env.PORT || 5000,
  BASE_URL: process.env.BASE_URL || "https://daily-report-backend.officemuckup.com",
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
  PRODUCTION_URL: process.env.PRODUCTION_URL || "https://daily-report-frontend.officemuckup.com",
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
