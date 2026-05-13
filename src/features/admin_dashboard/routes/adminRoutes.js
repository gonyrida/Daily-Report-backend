// src/features/admin_dashboard/routes/adminRoutes.js
const express = require("express");
const { authenticateToken } = require("../../../middleware/authMiddleware");
const {
  getAllUsers,
  getRecentUsers,
  createUser,
  updateUser,
  deleteUser
} = require("../controllers/adminController");

const router = express.Router();

// All admin routes require authentication
router.get("/all-users", authenticateToken, getAllUsers);
router.get("/recent-users", authenticateToken, getRecentUsers);
router.post("/users", authenticateToken, createUser);
router.put("/users/:id", authenticateToken, updateUser);
router.delete("/users/:id", authenticateToken, deleteUser);
module.exports = router;