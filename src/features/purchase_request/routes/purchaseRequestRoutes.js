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
  updatePurchaseRequest,
  getPendingApprovals,
  revisedPurchaseRequest,
  getProjectPurchaseRequestsSummary
} = require("../controllers/purchaseRequestController");
const {
  getAuditLogs,
  addComment
} = require("../controllers/requestAuditLogController");
const {
  createPRProject,
  getPRProjects,
  getPRProjectById,
  updatePRProject,
  deletePRProject
} = require("../controllers/projectPRController");

const router = express.Router();

// ../controllers/purchaseRequestController (1)
router.post("/", authenticateToken, createPurchaseRequest);
router.get("/", authenticateToken, getPurchaseRequests);
router.get("/pending-approvals", authenticateToken, getPendingApprovals);

// ../controllers/projectPRController
router.get("/pr-projects", authenticateToken, getPRProjects);
router.post("/pr-projects", authenticateToken, createPRProject);
router.get("/pr-projects/:id", authenticateToken, getPRProjectById);
router.put("/pr-projects/:id", authenticateToken, updatePRProject);
router.delete("/pr-projects/:id", authenticateToken, deletePRProject);
router.get("/pr-summary/:projectId/:id", authenticateToken, getProjectPurchaseRequestsSummary);

// ../controllers/purchaseRequestController (2)
router.get("/my-requests", authenticateToken, getMyPurchaseRequests);
router.get('/users', authenticateToken, getAllUsers);
router.get("/:id", authenticateToken, getPurchaseRequestById);

// ../controllers/requestAuditLogController
router.get("/:id/audit-logs", authenticateToken, getAuditLogs);
router.post("/:id/audit-logs/comment", authenticateToken, addComment);

// ../controllers/purchaseRequestController (3)
router.post("/:id/revise", authenticateToken, revisedPurchaseRequest);
router.put("/:id", authenticateToken, updatePurchaseRequest);
router.put("/:id/status", authenticateToken, updatePurchaseRequestStatus);
router.delete("/:id", authenticateToken, deletePurchaseRequest);

module.exports = router;