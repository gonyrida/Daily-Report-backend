const weeklyReportService = require('../services/weeklyReportService');

/**
 * Get all weekly reports for a user with pagination and filtering
 */
const getWeeklyReports = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      page = 1,
      limit = 10,
      status,
      projectName,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      projectName,
      startDate,
      endDate,
      sortBy,
      sortOrder
    };

    const result = await weeklyReportService.getAllReports(userId, options);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
        message: 'Weekly reports retrieved successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        details: result.details
      });
    }
  } catch (error) {
    console.error('Controller error in getWeeklyReports:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Get a single weekly report by ID
 */
const getWeeklyReportById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const companyId = req.user.companyId; // ← ADD THIS

    const result = await weeklyReportService.getReportById(id, userId, companyId); // ← PASS companyId

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        message: 'Weekly report retrieved successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Controller error in getWeeklyReportById:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Create a new weekly report
 */
const createWeeklyReport = async (req, res) => {
  try {
    const userId = req.user.userId;
    const companyId = req.user.companyId; // ← ADD THIS
    const reportData = req.body;
    const { aggregateManpower = false, aggregationOptions = {} } = req.body;

    let result;
    if (aggregateManpower) {
      // Create with automatic manpower aggregation
      result = await weeklyReportService.createReportWithManpower(userId, companyId, reportData, aggregationOptions);
    } else {
      // Create without aggregation (original behavior)
      result = await weeklyReportService.createReport(userId, companyId, reportData);
    }

    if (result.success) {
      res.status(201).json({
        success: true,
        data: result.data,
        message: result.message,
        warning: result.warning || null
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        details: result.details
      });
    }
  } catch (error) {
    console.error('Controller error in createWeeklyReport:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Update a weekly report (full or partial)
 */
const updateWeeklyReport = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const updateData = req.body;

    const result = await weeklyReportService.updateReport(id, userId, updateData);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        details: result.details
      });
    }
  } catch (error) {
    console.error('Controller error in updateWeeklyReport:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Delete a weekly report (soft delete)
 */
const deleteWeeklyReport = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const result = await weeklyReportService.deleteReport(id, userId);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Controller error in deleteWeeklyReport:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Submit a weekly report
 */
const submitWeeklyReport = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const result = await weeklyReportService.submitReport(id, userId);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Controller error in submitWeeklyReport:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Approve a weekly report
 */
const approveWeeklyReport = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const result = await weeklyReportService.approveReport(id, userId);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Controller error in approveWeeklyReport:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Reject a weekly report
 */
const rejectWeeklyReport = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const { reason } = req.body;

    const result = await weeklyReportService.rejectReport(id, userId, reason);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Controller error in rejectWeeklyReport:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Auto-save weekly report (for real-time saving)
 */
const autoSaveWeeklyReport = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const updateData = req.body;

    const result = await weeklyReportService.autoSaveReport(id, userId, updateData);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        message: 'Auto-save completed successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Controller error in autoSaveWeeklyReport:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Get weekly report template
 */
const getWeeklyReportTemplate = async (req, res) => {
  try {
    const { projectName } = req.query;

    const result = await weeklyReportService.getTemplate(projectName);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        message: 'Template generated successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Controller error in getWeeklyReportTemplate:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Duplicate a weekly report
 */
const duplicateWeeklyReport = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const { weekNumber, startDate, endDate } = req.body;

    // First get the original report
    const originalResult = await weeklyReportService.getReportById(id, userId);
    
    if (!originalResult.success) {
      return res.status(404).json({
        success: false,
        error: 'Original report not found'
      });
    }

    // Create new report based on original
    const newReportData = {
      ...originalResult.data,
      weekNumber,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: 'draft',
      submittedAt: null,
      submittedBy: null,
      approvedAt: null,
      approvedBy: null,
      version: 1
    };

    const result = await weeklyReportService.createReport(userId, newReportData);

    if (result.success) {
      res.status(201).json({
        success: true,
        data: result.data,
        message: 'Weekly report duplicated successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        details: result.details
      });
    }
  } catch (error) {
    console.error('Controller error in duplicateWeeklyReport:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Validate weekly report before submission
 */
const validateWeeklyReport = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const result = await weeklyReportService.getReportById(id, userId);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.error
      });
    }

    const report = result.data;
    const errors = [];
    const warnings = [];

    // Validation checks
    if (!report.sections.cover?.projectName) {
      errors.push('Project name is required in cover section');
    }

    if (!report.sections.activities?.weeklyActivities?.length) {
      errors.push('At least one weekly activity is required');
    }

    if (!report.sections.activities?.nextWeekPlan?.length) {
      warnings.push('No activities planned for next week');
    }

    if (!report.sections.hses?.training?.length && !report.sections.hses?.inspection?.length) {
      warnings.push('No HSE training or inspections recorded');
    }

    if (!report.sections.overallProgress?.rows?.length) {
      warnings.push('No overall progress items recorded');
    }

    // Validate master schedule if present
    if (report.sections.masterSchedule && Array.isArray(report.sections.masterSchedule)) {
      report.sections.masterSchedule.forEach((schedule, index) => {
        if (!schedule.id) {
          errors.push(`Master schedule item ${index + 1} is missing ID`);
        }
        if (!schedule.type) {
          errors.push(`Master schedule item ${index + 1} is missing type`);
        }
        if (!schedule.title) {
          errors.push(`Master schedule item ${index + 1} is missing title`);
        }
        if (!schedule.date) {
          errors.push(`Master schedule item ${index + 1} is missing date`);
        }
      });
    }

    const isValid = errors.length === 0;

    res.status(200).json({
      success: true,
      data: {
        isValid,
        errors,
        warnings
      },
      message: isValid ? 'Report is valid for submission' : 'Report has validation errors'
    });
  } catch (error) {
    console.error('Controller error in validateWeeklyReport:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Aggregate manpower data for a weekly report
 */
const aggregateManpower = async (req, res) => {
  try {
    const { projectName, startDate, endDate } = req.query;
    const { includePrevWeek = false, includeAccumulated = false } = req.body;

    if (!projectName || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: projectName, startDate, endDate'
      });
    }

    const options = { includePrevWeek, includeAccumulated };
    const result = await weeklyReportService.aggregateWeeklyManpower(
      projectName,
      new Date(startDate),
      new Date(endDate),
      options
    );

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        details: result.details
      });
    }
  } catch (error) {
    console.error('Controller error in aggregateManpower:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Update weekly report with aggregated manpower data
 */
const updateReportManpower = async (req, res) => {
  try {
    const { id } = req.params;
    const { includePrevWeek = false, includeAccumulated = false } = req.body;

    const options = { includePrevWeek, includeAccumulated };
    const result = await weeklyReportService.updateReportManpower(id, options);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        details: result.details
      });
    }
  } catch (error) {
    console.error('Controller error in updateReportManpower:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Get company-wide weekly reports (submitted only)
 * Similar to getCompanyReports in dailyReportController
 */
const getCompanyWeeklyReports = async (req, res) => {
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

    const result = await weeklyReportService.getCompanyWeeklyReports(
      companyId,
      parseInt(page),
      parseInt(limit),
      search,
      project
    );

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch company weekly reports",
        error: result.error
      });
    }

    res.status(200).json({
      success: true,
      message: "Company weekly reports fetched successfully",
      reports: result.data,
      pagination: result.pagination
    });

  } catch (error) {
    console.error("Get company weekly reports controller error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching company weekly reports",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

module.exports = {
  getWeeklyReports,
  getWeeklyReportById,
  createWeeklyReport,
  updateWeeklyReport,
  deleteWeeklyReport,
  submitWeeklyReport,
  approveWeeklyReport,
  rejectWeeklyReport,
  autoSaveWeeklyReport,
  getWeeklyReportTemplate,
  duplicateWeeklyReport,
  validateWeeklyReport,
  // Company reports endpoint
  getCompanyWeeklyReports,
  // Manpower aggregation endpoints
  aggregateManpower,
  updateReportManpower
};
