const dailyReportService = require("../services/dailyReportService");

// Get all reports for authenticated user only
const getDailyReports = async (req, res) => {
  try {
    const reports = await dailyReportService.getAllReports(req.user.userId);
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create a new report for authenticated user
const createDailyReport = async (req, res) => {
  try {
    const report = await dailyReportService.createReport(req.user.userId, req.body);
    res.status(201).json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getReportByDate = async (req, res) => {
  try {
    console.log("DEBUG BACKEND CONTROLLER: getReportByDate called");
    console.log("DEBUG BACKEND CONTROLLER: req.user:", req.user);
    console.log("DEBUG BACKEND CONTROLLER: req.params:", req.params);
    console.log("DEBUG BACKEND CONTROLLER: req.query:", req.query);

    // AUTH GUARD: Ensure user is authenticated
    if (!req.user || !req.user.userId) {
      console.error("DEBUG BACKEND: Authentication failed - no user context");
      return res.status(401).json({ 
        success: false,
        message: "Authentication required" 
      });
    }

    const { date } = req.params; // e.g., "2025-12-29"
    const { projectName } = req.params;

    // FIX: Force interpretation as UTC Midnight
    const normalizedDate = new Date(`${date}T00:00:00.000Z`);
    console.log(
      "DEBUG BACKEND CONTROLLER: Normalized date:",
      normalizedDate.toISOString()
    );

    // Determine projectName from params or query
    const projectNameToUse = projectName || req.query.projectName || null;

    console.log(
      "DEBUG BACKEND CONTROLLER: Searching by userId + date, projectName:",
      projectNameToUse
    );

    const report = await dailyReportService.getReportByDate(
      req.user.userId,
      normalizedDate,
      projectNameToUse
    );

    console.log(
      "DEBUG BACKEND CONTROLLER: Report found:",
      report ? "YES" : "NO"
    );

    if (!report) {
      return res.status(404).json({ 
        success: false,
        message: "Report not found" 
      });
    }
    
    res.json(report);
  } catch (error) {
    console.error("DEBUG BACKEND CONTROLLER: getReportByDate error:", error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Save or update report
const saveOrUpdateReport = async (req, res) => {
  try {
    console.log("DEBUG BACKEND CONTROLLER: Save request received");

    // AUTH GUARD: Ensure user is authenticated
    if (!req.user || !req.user.userId) {
      console.error("DEBUG BACKEND: Authentication failed - no user context");
      return res.status(401).json({ 
        success: false,
        message: "Authentication required" 
      });
    }

    const reportData = req.body;
    console.log("DEBUG BACKEND CONTROLLER: Received reportData:", reportData);
    if (!reportData.reportDate)
      return res.status(400).json({ 
        success: false,
        message: "Date required" 
      });

    // Extract userId from authenticated user
    const userId = req.user.userId;
    console.log("DEBUG BACKEND: Saving report for userId:", userId);

    // Fix date normalization to handle timezone properly
    const dateStr = reportData.reportDate;
    const dateObj = new Date(dateStr);
    const utcDate = new Date(
      dateObj.getTime() - dateObj.getTimezoneOffset() * 60000
    );
    const dateOnly = utcDate.toISOString().split("T")[0];
    reportData.reportDate = new Date(`${dateOnly}T00:00:00.000Z`);

    console.log("DEBUG BACKEND: Normalized reportDate:", reportData.reportDate);

    console.log("DEBUG BACKEND: Calling saveOrUpdateReport service with:", {
      userId,
      reportDate: reportData.reportDate,
    });

    const report = await dailyReportService.saveOrUpdateReport(
      userId,
      reportData
    );
    console.log("DEBUG BACKEND: Report saved successfully:", report._id);
    return res
      .status(200)
      .json({ 
        success: true,
        message: "Report saved successfully", 
        data: report 
      });
  } catch (error) {
    console.error("DEBUG BACKEND: Save error:", error);
    return res.status(500).json({ 
      success: false,
      message: "Failed to save report" 
    });
  }
};

// Submit report - FIXED: use req.body instead of req.query
const submitReport = async (req, res) => {
  // DEBUG 2: Confirm the request reached the backend and check the body
  console.log("DEBUG BACKEND CONTROLLER: Received Body ->", req.body);

  try {
    // AUTH GUARD: Ensure user is authenticated
    if (!req.user || !req.user.userId) {
      console.error("DEBUG BACKEND: Authentication failed - no user context");
      return res.status(401).json({ 
        success: false,
        message: "Authentication required" 
      });
    }

    const { projectName, date } = req.body;
    const userId = req.user.userId; // Extract userId from authenticated user
    const datePart = new Date(date).toISOString().split("T")[0];
    const normalizedDate = new Date(`${datePart}T00:00:00.000Z`);

    // DEBUG 3: Check normalization before passing to Service
    console.log(
      "DEBUG BACKEND CONTROLLER: Normalized Date ->",
      normalizedDate.toISOString()
    );

    const report = await dailyReportService.submitDailyReport(
      userId,
      projectName,
      normalizedDate
    );
    // Even if something went weird, if we got here, send success
    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error("Submit Error:", error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

module.exports = {
  getDailyReports,
  createDailyReport,
  getReportByDate,
  saveOrUpdateReport,
  submitReport,
};
