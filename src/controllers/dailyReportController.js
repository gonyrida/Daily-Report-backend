const dailyReportService = require("../services/dailyReportService");
const DailyReport = require('../models/dailyReportModel');

// Get all reports for authenticated user
const getDailyReports = async (req, res) => {
  try {
    const userId = req.user.userId;
    const reports = await dailyReportService.getAllReports(userId);
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get a specific report by ID
const getReportById = async (req, res) => {
  try {
    const { reportId } = req.params;
    const userId = req.user.userId;
    const companyId = req.user.companyId; // ← ADD THIS
    
    console.log("DEBUG BACKEND CONTROLLER: getReportById called for:", { reportId, userId });
    
    const report = await dailyReportService.getReportById(userId, reportId, companyId); // ← ADD THIS
    
    if (!report) {
      console.log("DEBUG BACKEND CONTROLLER: Report not found");
      return res.status(404).json({ message: "Report not found" });
    }
    
    console.log("DEBUG BACKEND CONTROLLER: Report found and returned");
    res.json(report);
  } catch (error) {
    console.error("DEBUG BACKEND CONTROLLER: getReportById error:", error);
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

    // 🔒 NEW QUERY: Find most recent report for this date
    const report = await DailyReport.findOne({ 
      reportDate: date,
      userId: req.user.userId 
    }).sort({ updatedAt: -1 }); // Sort by most recent first
    console.log("🐛 DEBUG BACKEND: findOne result:", report);

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
    console.log('🔧 DEBUG: req.user:', req.user);
    console.log('🔧 DEBUG: req.user.companyId:', req.user.companyId);
    const reportData = req.body;
    console.log("DEBUG BACKEND CONTROLLER: Received reportData:", reportData);
    if (!reportData.reportDate)
      return res.status(400).json({ 
        success: false,
        message: "Date required" 
      });

    // Extract userId from authenticated user
    const userId = req.user.userId;
    const companyId = req.user.companyId; // ← ADD THIS LINE
    if (!userId) {
      console.error("DEBUG BACKEND: No userId found in req.user");
      return res.status(401).json({ message: "User authentication required" });
    }

    console.log("DEBUG BACKEND: Saving report for userId:", userId);
    console.log("DEBUG BACKEND: Saving report for companyId:", companyId); // ← ADD THIS

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
      companyId, // ← ADD THIS
      reportDate: reportData.reportDate,
    });

    const report = await dailyReportService.saveOrUpdateReport(
      userId,
      reportData,
      companyId // ← ADD COMPANYID PARAMETER
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

const createNewReport = async (req, res) => {
  console.log('🔧 DEBUG: req.user:', req.user);
  console.log('🔧 DEBUG: req.user.companyId:', req.user.companyId);
  try {
    const { projectName, date } = req.body;
    const userId = req.user.userId; // Extract userId from authenticated user
    
    // Validate required fields
    if (!date) {
      return res.status(400).json({ message: "Date is required" });
    }
    
    const datePart = new Date(date).toISOString().split("T")[0];
    const normalizedDate = new Date(`${datePart}T00:00:00.000Z`);

    console.log("DEBUG BACKEND CONTROLLER: Creating new report for:", {
      userId,
      projectName,
      date: normalizedDate.toISOString(),
    });

    const report = await dailyReportService.createNewReport(
      userId,
      projectName,
      normalizedDate,
      req.user.companyId // ← ADD COMPANY ID
    );
    
    console.log("DEBUG BACKEND CONTROLLER: New report created with ID:", report._id);
    
    res.status(201).json({
      success: true,
      data: report,
      message: "New report created successfully",
    });
  } catch (error) {
    console.error("Create New Report Error:", error);
    res.status(500).json({ error: error.message });
  }
};

const createBlankReport = async (req, res) => {
  try {
    const { projectName } = req.body;
    const userId = req.user.userId;
    
    console.log("DEBUG BACKEND CONTROLLER: Creating blank report for:", { userId, projectName });

    const report = await dailyReportService.createBlankReport(userId, projectName);
    
    console.log("DEBUG BACKEND CONTROLLER: Blank report created with ID:", report._id);
    
    res.status(201).json({
      success: true,
      data: report,
      message: "Blank report created successfully",
    });
  } catch (error) {
    console.error("Create Blank Report Error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Auto-save report (partial update)
const autoSaveReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const userId = req.user.userId;
    const partialData = req.body;
    
    console.log("DEBUG BACKEND CONTROLLER: Auto-saving report:", { reportId, userId });

    const report = await dailyReportService.autoSaveReport(userId, reportId, partialData);
    
    console.log("DEBUG BACKEND CONTROLLER: Auto-save completed:", report._id);
    
    res.status(200).json({
      success: true,
      data: report,
      message: "Report auto-saved successfully",
    });
  } catch (error) {
    console.error("Auto-save Error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get recent reports for dashboard
const getRecentReports = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 20, status } = req.query;
    
    console.log("DEBUG BACKEND CONTROLLER: Fetching recent reports for:", { userId, limit, status });

    const reports = await dailyReportService.getRecentReports(
      userId, 
      parseInt(limit), 
      status
    );
    
    console.log("DEBUG BACKEND CONTROLLER: Found", reports.length, "recent reports");
    
    res.status(200).json({
      success: true,
      data: reports,
      message: "Recent reports fetched successfully",
    });
  } catch (error) {
    console.error("Get Recent Reports Error:", error);
    res.status(500).json({ error: error.message });
  }
};

const deleteReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const userId = req.user.userId;
    
    console.log("DEBUG BACKEND CONTROLLER: Deleting report:", { reportId, userId });
    
    const result = await dailyReportService.deleteReport(userId, reportId);
    
    if (!result) {
      console.log("DEBUG BACKEND CONTROLLER: Report not found for deletion");
      return res.status(404).json({ message: "Report not found" });
    }
    
    console.log("DEBUG BACKEND CONTROLLER: Report deleted successfully");
    res.status(200).json({ message: "Report deleted successfully" });
  } catch (error) {
    console.error("DEBUG BACKEND CONTROLLER: Delete error:", error);
    res.status(500).json({ error: error.message });
  }
};

const getCompanyReports = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "", project = "" } = req.query;
    const companyId = req.user.companyId;

    // Check if user has companyId
    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: "You are not associated with any company"
      });
    }

    const result = await dailyReportService.getCompanyReports(
      companyId,
      parseInt(page),
      parseInt(limit),
      search,
      project // ← ADD PROJECT FILTER
    );

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch company reports",
        error: result.error
      });
    }

    res.status(200).json({
      success: true,
      message: "Company reports fetched successfully",
      reports: result.data,
      pagination: result.pagination
    });

  } catch (error) {
    console.error("Get company reports controller error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching company reports",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

const getCompanyProjects = async (req, res) => {
  try {
    const companyId = req.user.companyId;

    // Check if user has companyId
    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: "You are not associated with any company"
      });
    }

    // Get all unique project names from company reports
    const projects = await DailyReport.distinct('projectName', {
      companyId: companyId,
      projectName: { $ne: null, $exists: true }
    });

    res.status(200).json({
      success: true,
      message: "Company projects fetched successfully",
      projects: projects.sort() // Sort alphabetically
    });

  } catch (error) {
    console.error("Get company projects controller error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching company projects",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

module.exports = {
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
  getCompanyReports,
  getCompanyProjects
};
