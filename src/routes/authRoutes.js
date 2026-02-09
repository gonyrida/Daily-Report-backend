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
  getLoginHistory,
  revokeSession,
  revokeAllSessions,
  deactivateAccount,
  deleteAccount,
  verifyEmail,
  resendVerification,
} = require("../controllers/authController");
const { authenticateToken } = require("../middleware/authMiddleware");
const { passwordResetRateLimit, passwordResetConfirmRateLimit } = require("../middleware/rateLimiter");

const router = express.Router();

// Public routes
router.post("/register", register);
router.post("/login", login); // Make sure this line exists
router.post("/forgot-password", passwordResetRateLimit, forgotPassword);
router.post("/reset-password", passwordResetConfirmRateLimit, resetPassword);
router.post("/test-email", testEmail); // For testing email functionality
router.get("/verify-email", verifyEmail); // Email verification endpoint
router.post("/resend-verification", resendVerification); // Resend verification email

// Protected routes
router.post("/logout", authenticateToken, logout);
router.get("/profile", authenticateToken, getProfile);
router.put("/profile", authenticateToken, updateProfile);
router.put("/change-password", authenticateToken, changePassword);
router.get("/verify", authenticateToken, verifyToken);
router.get("/login-history", authenticateToken, getLoginHistory);
router.post("/revoke-session/:sessionId", authenticateToken, revokeSession);
router.post("/revoke-all-sessions", authenticateToken, revokeAllSessions);
router.post("/deactivate-account", authenticateToken, deactivateAccount);
router.delete("/delete-account", authenticateToken, deleteAccount);

module.exports = router;
