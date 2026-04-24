const express = require("express");
const router = express.Router();

// FIX: Destructure the specific function 'authenticateToken'
const { authenticateToken } = require("../middleware/authMiddleware");

const {
  getDailyReports,
  getReportById,
  getReportByDate,
  upsertDailyReport,
  submitReport,
  createNewReport,
  createBlankReport,
  autoSaveReport,
  getRecentReports,
  deleteReport,
  getCompanyReports,
  getCompanyProjects,
  getLocations,
  getDailyReportsByLocation
} = require("../controllers/dailyReportController");

// Import bulk import functions from weekly report service
const {
  bulkImportActivities,
  getActivitiesByBulkImportId,
  getBulkImportStats
} = require("../services/weeklyReportService");

// Use 'authenticateToken' instead of 'authMiddleware'
router.get("/", authenticateToken, getDailyReports);
router.get("/recent", authenticateToken, getRecentReports);
router.get("/projects", authenticateToken, getCompanyProjects);
router.get("/company", authenticateToken, getCompanyReports);
router.get("/locations", authenticateToken, getLocations);
router.get("/by-location", authenticateToken, getDailyReportsByLocation);
router.get("/:reportId", authenticateToken, getReportById);
router.post("/", authenticateToken, createNewReport);
router.post("/blank", authenticateToken, createBlankReport); // New: Create blank report immediately
router.post("/upsert", authenticateToken, upsertDailyReport); // New: Upsert with proper update/insert logic
router.patch("/:reportId/auto-save", authenticateToken, autoSaveReport); // New: Auto-save (partial update)
router.post("/submit", authenticateToken, submitReport);

// NEW: Bulk import routes
router.post("/:reportId/bulk-import", authenticateToken, async (req, res) => {
  try {
    const { reportId } = req.params;
    const userId = req.user.userId;
    
    console.log("DEBUG BACKEND: Bulk import request for report:", reportId);
    
    const result = await bulkImportActivities(reportId, req.body);
    res.json(result);
  } catch (error) {
    console.error("DEBUG BACKEND: Bulk import error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/bulk-import/:bulkId", authenticateToken, async (req, res) => {
  try {
    const { bulkId } = req.params;
    const userId = req.user.userId;
    
    const activities = await getActivitiesByBulkImportId(userId, bulkId);
    res.json({ activities });
  } catch (error) {
    console.error("DEBUG BACKEND: Get bulk import activities error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/bulk-import/stats", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const stats = await getBulkImportStats(userId);
    res.json(stats);
  } catch (error) {
    console.error("DEBUG BACKEND: Get bulk import stats error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/date/:date", authenticateToken, getReportByDate);
router.get(
  "/project/:projectName/date/:date",
  authenticateToken,
  getReportByDate
);

router.delete("/:reportId", authenticateToken, deleteReport);

module.exports = router;
