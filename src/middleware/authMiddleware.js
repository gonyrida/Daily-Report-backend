const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/env");
const User = require("../models/userModel");
const TokenBlacklist = require("../models/tokenBlacklistModel");

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
    console.log("DEBUG AUTH MIDDLEWARE: User found:", user ? "YES" : "NO");

    if (!user || !user.isActive) {
      console.log("AUTH MIDDLEWARE: User not found or inactive - returning 401");
      return res.status(401).json({
        success: false,
        message: "Invalid token - user not found or inactive",
      });
    }

    // Add user to request object with full user info
    req.user = {
      ...decoded,
      name: `${user.firstName} ${user.lastName}`,  // Combine first + last name
      email: user.email,      // Add user's email
      companyId: user.companyId,  // ← ADD THIS LINE
      id: decoded.userId     // For backward compatibility
    };
    console.log(
      "DEBUG AUTH MIDDLEWARE: Authentication successful, user:",
      req.user
    );
    next();
  } catch (error) {
    console.log("DEBUG AUTH MIDDLEWARE: Authentication error:", error);

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
