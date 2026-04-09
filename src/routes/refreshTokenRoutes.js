const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const TokenBlacklist = require("../models/tokenBlacklistModel");
const { setTokenCookie } = require("../middleware/authMiddleware");
// dotenv.config() is already called in server.js
const generateToken = require("../utils/generateToken");

const router = express.Router();

// @desc    Refresh access token
// @route   POST /api/refresh-token
// @access  Public (but requires valid refresh token)
router.post("/", async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token required",
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    
    // Ensure it's a refresh token
    if (decoded.type !== "refresh") {
      return res.status(401).json({
        success: false,
        message: "Invalid token type",
      });
    }

    // Check if user still exists
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    // Generate new access token
    const newAccessToken = generateToken(user);
    
    // Set new access token cookie
    setTokenCookie(res, newAccessToken);

    res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
    });
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Refresh token expired",
      });
    }

    res.status(403).json({
      success: false,
      message: "Invalid refresh token",
    });
  }
});

module.exports = router;
