// src/features/purchase_request/routes/purchaseRequestRoutes.js
const express = require("express");
const { authenticateToken } = require("../../../middleware/authMiddleware");
const {
  createPurchaseRequest,
  getPurchaseRequests,
  getPurchaseRequestById,
  updatePurchaseRequestStatus,
  deletePurchaseRequest
} = require("../controllers/purchaseRequestController");

const router = express.Router();

// All purchase request routes require authentication
router.post("/", authenticateToken, createPurchaseRequest);
router.get("/", authenticateToken, getPurchaseRequests);
router.get("/:id", authenticateToken, getPurchaseRequestById);
router.put("/:id/status", authenticateToken, updatePurchaseRequestStatus);
router.delete("/:id", authenticateToken, deletePurchaseRequest);

module.exports = router;