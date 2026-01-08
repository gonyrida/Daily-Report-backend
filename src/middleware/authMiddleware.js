const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/env");
const User = require("../models/userModel");
const TokenBlacklist = require("../models/tokenBlacklistModel");

// Middleware to authenticate JWT tokens from cookies ONLY
const authenticateToken = async (req, res, next) => {
  try {
    console.log("AUTH MIDDLEWARE: Starting authentication");
    console.log("AUTH MIDDLEWARE: Cookies:", req.cookies);
    
    // ONLY read JWT from cookies - NEVER fallback to headers
    const token = req.cookies?.access_token;
    
    if (!token) {
      console.log("AUTH MIDDLEWARE: No token found in cookies - returning 401");
      return res.status(401).json({
        success: false,
        message: "Access token required",
      });
    }

    console.log("AUTH MIDDLEWARE: Token found in cookie, checking blacklist");
    
    // Check if token is blacklisted
    const blacklistedToken = await TokenBlacklist.findOne({ token });
    if (blacklistedToken) {
      console.log("AUTH MIDDLEWARE: Token is blacklisted - returning 401");
      return res.status(401).json({
        success: false,
        message: "Token has been revoked",
      });
    }

    console.log("AUTH MIDDLEWARE: Verifying JWT");
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log("AUTH MIDDLEWARE: JWT verified successfully:", decoded);

    console.log("AUTH MIDDLEWARE: Checking user exists");
    
    // Check if user still exists
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      console.log("AUTH MIDDLEWARE: User not found or inactive - returning 401");
      return res.status(401).json({
        success: false,
        message: "Invalid token - user not found or inactive",
      });
    }

    console.log("AUTH MIDDLEWARE: Authentication successful");
    
    // Add user and token to request object
    req.user = decoded;
    req.token = token;
    next();
  } catch (error) {
    console.log("AUTH MIDDLEWARE: Error in authentication:", error.name, error.message);
    
    // PROPER ERROR HANDLING: Return 401 for ALL authentication failures
    if (error.name === "TokenExpiredError") {
      console.log("AUTH MIDDLEWARE: Token expired - returning 401");
      return res.status(401).json({
        success: false,
        message: "Token expired",
      });
    }
    
    if (error.name === "JsonWebTokenError") {
      console.log("AUTH MIDDLEWARE: Invalid JWT - returning 401");
      return res.status(401).json({
        success: false,
        message: "Invalid token format",
      });
    }
    
    // Any other authentication error = 401, NEVER 403
    console.log("AUTH MIDDLEWARE: Unknown auth error - returning 401");
    return res.status(401).json({
      success: false,
      message: "Authentication failed",
    });
  }
};

// Middleware to set JWT cookie
const setTokenCookie = (res, token) => {
  const isProduction = process.env.NODE_ENV === "production";

  const cookieOptions = {
    httpOnly: true,
    secure: isProduction, // Use false in development for localhost
    sameSite: isProduction ? "Strict" : "Lax", // Use Lax in development for localhost
    maxAge: 60 * 60 * 1000, // 1 hour
    path: "/",
  };

  // For localhost development, explicitly set domain to allow cross-subdomain cookies
  if (!isProduction) {
    cookieOptions.domain = undefined; // Allow localhost to work properly
  }

  console.log("AUTH MIDDLEWARE: Setting cookie with options:", cookieOptions);
  console.log("AUTH MIDDLEWARE: Token being set:", token ? "[PRESENT]" : "[MISSING]");
  
  res.cookie("access_token", token, cookieOptions);
};

// Middleware to clear JWT cookie
const clearTokenCookie = (res) => {
  const isProduction = process.env.NODE_ENV === "production";
  
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "Strict" : "Lax",
    expires: new Date(0), // Immediately expire
    path: "/",
  };

  // For localhost development, match the domain settings
  if (!isProduction) {
    cookieOptions.domain = undefined; // Allow localhost to work properly
  }

  res.cookie("access_token", "", cookieOptions);
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
  setTokenCookie,
  clearTokenCookie,
  authorizeRoles,
};
