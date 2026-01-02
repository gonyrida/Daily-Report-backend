const express = require("express");
const router = express.Router();

// FIX: Destructure the specific function 'authenticateToken'
const { authenticateToken } = require("../middleware/authMiddleware");

const {
  getDailyReports,
  createDailyReport,
  getReportByDate,
  saveOrUpdateReport,
  submitReport,
} = require("../controllers/dailyReportController");

// Use 'authenticateToken' instead of 'authMiddleware'
router.get("/", getDailyReports);
router.post("/", createDailyReport);
router.post("/save", authenticateToken, saveOrUpdateReport);
router.post("/submit", authenticateToken, submitReport); 

router.get("/date/:date", authenticateToken, getReportByDate);
router.get("/project/:projectName/date/:date", authenticateToken, getReportByDate);

module.exports = router;