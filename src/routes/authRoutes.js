const express = require("express");
const {
  register,
  login,
  logout,
  forgotPassword,
  resetPassword,
  getProfile,
  updateProfile,
  changePassword,
  verifyToken,
  testEmail,
} = require("../controllers/authController");
const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();

// Public routes
router.post("/register", register);
router.post("/login", login); // Make sure this line exists
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/test-email", testEmail); // For testing email functionality

// Protected routes
router.post("/logout", authenticateToken, logout);
router.get("/profile", authenticateToken, getProfile);
router.put("/profile", authenticateToken, updateProfile);
router.put("/change-password", authenticateToken, changePassword);
router.get("/verify", authenticateToken, verifyToken);

module.exports = router;
