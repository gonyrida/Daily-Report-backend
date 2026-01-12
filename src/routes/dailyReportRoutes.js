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

// Apply authentication to ALL routes
router.use(authenticateToken);

router.get("/", getDailyReports);
router.post("/", createDailyReport);
router.post("/save", saveOrUpdateReport);
router.post("/submit", submitReport); 

router.get("/date/:date", getReportByDate);
router.get("/project/:projectName/date/:date", getReportByDate);

module.exports = router;