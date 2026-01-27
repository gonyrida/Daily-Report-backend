const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/env");
const User = require("../models/userModel");

// Middleware to authenticate JWT tokens from cookies
const authenticateToken = async (req, res, next) => {
  try {
    console.log("DEBUG AUTH MIDDLEWARE: Checking authentication");
    console.log("DEBUG AUTH MIDDLEWARE: Cookies:", req.cookies);

    // Try to get token from cookie first (cookie-based auth)
    let token = req.cookies?.token;

    // Fallback to Authorization header if no cookie (for backward compatibility)
    if (!token) {
      const authHeader = req.headers.authorization;
      token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN
      console.log(
        "DEBUG AUTH MIDDLEWARE: No cookie token, trying header:",
        authHeader ? "PRESENT" : "MISSING"
      );
    }

    // Fallback to custom header for localStorage tokens
    if (!token) {
      token = req.headers['x-auth-token'];
      console.log("DEBUG AUTH MIDDLEWARE: Trying custom header:", token ? "PRESENT" : "MISSING");
    }

    console.log("DEBUG AUTH MIDDLEWARE: Token:", token ? "PRESENT" : "MISSING");

    if (!token) {
      console.log("DEBUG AUTH MIDDLEWARE: No token provided");
      return res.status(401).json({
        success: false,
        message: "Access token required",
      });
    }
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log("DEBUG AUTH MIDDLEWARE: Token decoded:", decoded);

    // Check if user still exists
    const user = await User.findById(decoded.userId);
    console.log("DEBUG AUTH MIDDLEWARE: User found:", user ? "YES" : "NO");

    if (!user || !user.isActive) {
      console.log("DEBUG AUTH MIDDLEWARE: User not found or inactive");
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    // Add user to request object
    req.user = decoded;
    req.token = token; // Add token for session tracking
    console.log(
      "DEBUG AUTH MIDDLEWARE: Authentication successful, user:",
      req.user
    );
    next();
  } catch (error) {
    console.log("DEBUG AUTH MIDDLEWARE: Authentication error:", error);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired",
      });
    }

    console.error("Authentication error:", error);
    res.status(403).json({
      success: false,
      message: "Invalid token",
    });
  }
};

// Middleware to check if user has required role
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions",
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  authorizeRoles,
};
