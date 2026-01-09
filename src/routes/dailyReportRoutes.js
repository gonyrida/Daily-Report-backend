const express = require("express");
const router = express.Router();

// FIX: Destructure the specific function 'authenticateToken'
const { authenticateToken } = require("../middleware/authMiddleware");

const {
  getDailyReports,
  getReportById,
  getReportByDate,
  saveOrUpdateReport,
  submitReport,
  createNewReport,
  createBlankReport,
  autoSaveReport,
  getRecentReports,
  deleteReport,
} = require("../controllers/dailyReportController");

// Use 'authenticateToken' instead of 'authMiddleware'
router.get("/", authenticateToken, getDailyReports);
router.get("/recent", authenticateToken, getRecentReports); // New: Recent reports for dashboard
router.get("/:reportId", authenticateToken, getReportById);
router.post("/", authenticateToken, createNewReport);
router.post("/blank", authenticateToken, createBlankReport); // New: Create blank report immediately
router.post("/save", authenticateToken, saveOrUpdateReport);
router.patch("/:reportId/auto-save", authenticateToken, autoSaveReport); // New: Auto-save (partial update)
router.post("/submit", authenticateToken, submitReport);

router.get("/date/:date", authenticateToken, getReportByDate);
router.get(
  "/project/:projectName/date/:date",
  authenticateToken,
  getReportByDate
);

router.delete("/:reportId", authenticateToken, deleteReport);

module.exports = router;
