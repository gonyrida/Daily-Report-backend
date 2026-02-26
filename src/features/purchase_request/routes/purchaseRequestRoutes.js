// src/features/purchase_request/routes/purchaseRequestRoutes.js
const express = require("express");
const { authenticateToken } = require("../../../middleware/authMiddleware");
const {
  createPurchaseRequest,
  getPurchaseRequests,
  getPurchaseRequestById,
  updatePurchaseRequestStatus,
  deletePurchaseRequest,
  getAllUsers,
  getMyPurchaseRequests,
  updatePurchaseRequest
} = require("../controllers/purchaseRequestController");

const router = express.Router();

// All purchase request routes require authentication
router.post("/", authenticateToken, createPurchaseRequest);
router.get("/", authenticateToken, getPurchaseRequests);
router.get("/my-requests", authenticateToken, getMyPurchaseRequests);
router.get('/users', authenticateToken, getAllUsers);
router.get("/:id", authenticateToken, getPurchaseRequestById);
router.put("/:id", authenticateToken, updatePurchaseRequest);
router.put("/:id/status", authenticateToken, updatePurchaseRequestStatus);
router.delete("/:id", authenticateToken, deletePurchaseRequest);

module.exports = router;