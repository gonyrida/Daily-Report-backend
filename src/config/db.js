const mongoose = require("mongoose");
const os = require("os");

// MongoDB URI selection based on hostname
const getMongoDBURI = () => {
  // If explicitly set in environment, use that
  if (process.env.MONGODB_URI) {
    console.log("Using MONGODB_URI from environment variable");
    return process.env.MONGODB_URI;
  }

  const hostname = os.hostname().toLowerCase();
  console.log(`Detected hostname: ${hostname}`);
  
  // Define your machine hostnames here
  const desktopHostnames = ['desktop', 'pc', 'workstation']; // Add your desktop hostname
  const laptopHostnames = ['laptop', 'notebook', 'mbp']; // Add your laptop hostname
  
  // Desktop connection string (multi-host replica set)
  const desktopURI = process.env.DESKTOP_URI || "mongodb://cacpm_users:cacpm1@ac-0fncxww-shard-00-02.edyltbr.mongodb.net:27017,ac-0fncxww-shard-00-01.edyltbr.mongodb.net:27017,ac-0fncxww-shard-00-00.edyltbr.mongodb.net:27017/test?ssl=true&replicaSet=atlas-jbgmcp-shard-0&authSource=admin";
  
  // Laptop connection string (SRV)
  const laptopURI = process.env.LAPTOP_URI || "mongodb+srv://cacpm_users:cacpm1@cacpm.edyltbr.mongodb.net/?appName=CACPM";
  
  // Check if hostname contains desktop identifiers
  if (desktopHostnames.some(desktop => hostname.includes(desktop))) {
    console.log(`Desktop environment detected (${hostname}), using replica set connection`);
    console.log(`Using Desktop URI: ${desktopURI.substring(0, 50)}...`);
    return desktopURI;
  }
  
  // Check if hostname contains laptop identifiers
  if (laptopHostnames.some(laptop => hostname.includes(laptop))) {
    console.log(`Laptop environment detected (${hostname}), using SRV connection`);
    console.log(`Using Laptop URI: ${laptopURI}`);
    return laptopURI;
  }
  
  // Fallback to SRV connection if hostname doesn't match
  console.log(`Unknown environment (${hostname}), using SRV connection as fallback`);
  console.log(`Using Fallback URI: ${laptopURI}`);
  return laptopURI;
};

const connectDB = async () => {
  try {
    const MONGODB_URI = getMongoDBURI();
    await mongoose.connect(MONGODB_URI, {
      family: 4
    });
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

module.exports = connectDB;
