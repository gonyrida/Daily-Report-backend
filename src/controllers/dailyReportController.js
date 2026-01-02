const dailyReportService = require("../services/dailyReportService");

// Get all reports
const getDailyReports = async (req, res) => {
  try {
    const reports = await dailyReportService.getAllReports();
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create a new report
const createDailyReport = async (req, res) => {
  try {
    const report = await dailyReportService.createReport(req.body);
    res.status(201).json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getReportByDate = async (req, res) => {
  try {
    const { date } = req.params; // e.g., "2025-12-29"
    const { projectName } = req.params;

    // FIX: Force interpretation as UTC Midnight
    const normalizedDate = new Date(`${date}T00:00:00.000Z`);

    let report;
    if (projectName) {
      report = await dailyReportService.getReportByDate(projectName, normalizedDate);
    } else {
      report = await dailyReportService.getReportByDateOnly(normalizedDate);
    }

    if (!report) return res.status(404).json({ message: "Report not found" });
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Save or update report
const saveOrUpdateReport = async (req, res) => {
  try {
    const reportData = req.body;
    if (!reportData.reportDate) return res.status(400).json({ message: "Date required" });

    // Force normalized UTC Date object
    const dateOnly = new Date(reportData.reportDate).toISOString().split('T')[0];
    reportData.reportDate = new Date(`${dateOnly}T00:00:00.000Z`);

    const report = await dailyReportService.saveOrUpdateReport(reportData);
    res.status(200).json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Submit report - FIXED: use req.body instead of req.query
const submitReport = async (req, res) => {
  // DEBUG 2: Confirm the request reached the backend and check the body
  console.log("DEBUG BACKEND CONTROLLER: Received Body ->", req.body);

  try {
    const { projectName, date } = req.body;
    const datePart = new Date(date).toISOString().split('T')[0];
    const normalizedDate = new Date(`${datePart}T00:00:00.000Z`);

    // DEBUG 3: Check normalization before passing to Service
    console.log("DEBUG BACKEND CONTROLLER: Normalized Date ->", normalizedDate.toISOString());

    const report = await dailyReportService.submitDailyReport(projectName, normalizedDate);
    // Even if something went weird, if we got here, send success
    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error("Submit Error:", error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getDailyReports,
  createDailyReport,
  getReportByDate,
  saveOrUpdateReport,
  submitReport,
};
