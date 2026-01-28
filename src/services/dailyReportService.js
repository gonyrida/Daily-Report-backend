const DailyReport = require("../models/dailyReportModel.js");
/**
 * Recalculate rolling totals for future reports when a past report is edited
 */
const recalculateFutureReports = async (userId, futureReports, session) => {
  for (let i = 0; i < futureReports.length; i++) {
    const currentReport = futureReports[i];

    // Get the previous report (either the one before this in the list or the last before the edited date)
    const previousReport =
      i > 0
        ? futureReports[i - 1]
        : await DailyReport.findOne({
            userId,
            reportDate: { $lt: currentReport.reportDate },
          })
            .sort({ reportDate: -1 })
            .session(session);

    // Helper function to recalculate rolling totals
    const recalculateRollingTotals = (items, previousItems = []) => {
      return items.map((item) => {
        const prevItem = previousItems.find(
          (p) => p.description === item.description
        );
        const prevAccum = prevItem?.accumulated || 0;
        const today = Number(item.today) || 0;
        return {
          ...item,
          prev: prevAccum,
          accumulated: prevAccum + today,
        };
      });
    };

    // Recalculate all arrays
    currentReport.managementTeam = recalculateRollingTotals(
      currentReport.managementTeam || [],
      previousReport?.managementTeam || []
    );

    currentReport.workingTeamInterior = recalculateRollingTotals(
      currentReport.workingTeamInterior || [],
      previousReport?.workingTeamInterior || []
    );

    currentReport.workingTeamMEP = recalculateRollingTotals(
      currentReport.workingTeamMEP || [],
      previousReport?.workingTeamMEP || []
    );

    // Keep backward compatibility for old workingTeam
    currentReport.workingTeam = recalculateRollingTotals(
      currentReport.workingTeam || [],
      previousReport?.workingTeam || []
    );

    currentReport.materials = recalculateRollingTotals(
      currentReport.materials || [],
      previousReport?.materials || []
    );

    currentReport.machinery = recalculateRollingTotals(
      currentReport.machinery || [],
      previousReport?.machinery || []
    );

    await currentReport.save({ session });
  }
};

/**
 * Get all reports for a specific user
 */
const getAllReports = async (userId) => {
  return await DailyReport.find({ userId }).sort({ reportDate: -1 });
};

/**
 * Get a specific report by ID and userId
 */
const getReportById = async (userId, reportId, companyId) => {
  // First try to find user's own report
  let report = await DailyReport.findOne({ _id: reportId, userId });
  
  // If not found and user has companyId, try company-wide access
  if (!report && companyId) {
    report = await DailyReport.findOne({ _id: reportId, companyId });
  }
  
  return report;
};

/**
 * Get a single report by userId + date
 */
const getReportByDate = async (userId, reportDate, projectName = null) => {
  // Create date range for the entire day
  const inputDate = new Date(reportDate);

  const startOfDay = new Date(
    Date.UTC(
      inputDate.getUTCFullYear(),
      inputDate.getUTCMonth(),
      inputDate.getUTCDate(),
      0,
      0,
      0,
      0
    )
  );

  const endOfDay = new Date(
    Date.UTC(
      inputDate.getUTCFullYear(),
      inputDate.getUTCMonth(),
      inputDate.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );

  console.log("Searching for report with:", {
    userId,
    projectName,
    startOfDay: startOfDay.toISOString(),
    endOfDay: endOfDay.toISOString(),
  });

  const query = {
    userId,
    reportDate: {
      $gte: startOfDay,
      $lte: endOfDay,
    },
  };

  if (projectName) {
    query.projectName = projectName;
  }

  const report = await DailyReport.findOne(query);

  console.log("Found report:", report ? "YES" : "NO");
  return report;
};

/**
 * Get a report by date only (no projectName required)
 * Used when loading report for a specific date
 */
const getReportByDateOnly = async (reportDate) => {
  // Create date range for the entire day
  const inputDate = new Date(reportDate);

  const startOfDay = new Date(
    Date.UTC(
      inputDate.getUTCFullYear(),
      inputDate.getUTCMonth(),
      inputDate.getUTCDate(),
      0,
      0,
      0,
      0
    )
  );

  const endOfDay = new Date(
    Date.UTC(
      inputDate.getUTCFullYear(),
      inputDate.getUTCMonth(),
      inputDate.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );

  console.log("Searching for any report on date:", {
    startOfDay: startOfDay.toISOString(),
    endOfDay: endOfDay.toISOString(),
  });

  const report = await DailyReport.findOne({
    reportDate: {
      $gte: startOfDay,
      $lte: endOfDay,
    },
  }).sort({ createdAt: -1 });

  console.log("Found report:", report ? "YES" : "NO");
  return report;
};

/**
 * Save or update a report with rolling totals recalculation
 * Uses transactions to prevent race conditions
 */
const saveOrUpdateReport = async (userId, reportData, companyId) => {
  console.log("DEBUG BACKEND SERVICE: saveOrUpdateReport called with:", {
    userId,
    projectName: reportData.projectName,
    reportDate: reportData.reportDate,
  });

  const session = await DailyReport.startSession();
  session.startTransaction();

  try {
    const { projectName, reportDate } = reportData;
    const inputDate = new Date(reportDate);

    // Set search window strictly in UTC
    const startOfDay = new Date(inputDate);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(inputDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    console.log("DEBUG BACKEND SERVICE: Searching for existing report:", {
      userId,
      projectName,
      startOfDay: startOfDay.toISOString(),
      endOfDay: endOfDay.toISOString(),
    });

    // Find existing report for this user
    let report = await DailyReport.findOne({
      userId,
      projectName,
      reportDate: { $gte: startOfDay, $lte: endOfDay },
    }).session(session);

    console.log(
      "DEBUG BACKEND SERVICE: Existing report found:",
      report ? "YES" : "NO"
    );

    // Get the previous report for rolling totals calculation
    const previousReport = await DailyReport.findOne({
      userId,
      reportDate: { $lt: startOfDay },
    })
      .sort({ reportDate: -1 })
      .session(session);

    console.log(
      "DEBUG BACKEND SERVICE: Previous report found:",
      previousReport ? "YES" : "NO"
    );

    // Helper function to calculate rolling totals
    const calculateRollingTotals = (newItems, previousItems = []) => {
      return newItems.map((item) => {
        const prevItem = previousItems.find(
          (p) => p.description === item.description
        );
        const prevAccum = prevItem?.accumulated || 0;
        const today = Number(item.today) || 0;
        return {
          ...item,
          prev: prevAccum,
          accumulated: prevAccum + today,
        };
      });
    };

    // Calculate rolling totals for all resource arrays
    const managementTeam = calculateRollingTotals(
      reportData.managementTeam || [],
      previousReport?.managementTeam || []
    );

    const workingTeamInterior = calculateRollingTotals(
      reportData.workingTeamInterior || [],
      previousReport?.workingTeamInterior || []
    );

    const workingTeamMEP = calculateRollingTotals(
      reportData.workingTeamMEP || [],
      previousReport?.workingTeamMEP || []
    );

    // Keep backward compatibility for old workingTeam
    const workingTeam = calculateRollingTotals(
      reportData.workingTeam || [],
      previousReport?.workingTeam || []
    );

    const materials = calculateRollingTotals(
      reportData.materials || [],
      previousReport?.materials || []
    );

    const machinery = calculateRollingTotals(
      reportData.machinery || [],
      previousReport?.machinery || []
    );

    if (report) {
      // Update existing report
      console.log(
        "DEBUG BACKEND SERVICE: Updating existing report:",
        report._id
      );
      report.set({
        ...reportData,
        companyId: companyId, // ← ADD THIS (ensures existing reports get companyId)
        managementTeam,
        workingTeamInterior,
        workingTeamMEP,
        workingTeam, // Keep backward compatibility
        materials,
        machinery,
        reportDate: inputDate,
      });
      await report.save({ session });
      console.log("DEBUG BACKEND SERVICE: Report updated successfully");
    } else {
      // Create new report
      console.log("DEBUG BACKEND SERVICE: Creating new report");
      report = new DailyReport({
        userId,
        companyId, // ← ADD THIS
        ...reportData,
        managementTeam,
        workingTeamInterior,
        workingTeamMEP,
        workingTeam, // Keep backward compatibility
        materials,
        machinery,
        reportDate: inputDate,
        status: "draft",
      });
      await report.save({ session });
      console.log("DEBUG BACKEND SERVICE: New report created with ID:", report._id);
      
      // 🚀 NEW: Update project statistics for new reports
      try {
        const Project = require('../models/projectModel');
        await Project.findOneAndUpdate(
          { 
            name: reportData.projectName, 
            isActive: true 
          },
          { 
            $inc: { reportCount: 1 },
            $set: { lastReportDate: inputDate }
          },
          { 
            new: true,
            upsert: false
          }
        );
        console.log("DEBUG BACKEND SERVICE: Project stats updated for:", reportData.projectName);
      } catch (projectError) {
        console.error("DEBUG BACKEND SERVICE: Failed to update project stats:", projectError);
      }
    }

    // Check if there are future reports that need recalculation
    const futureReports = await DailyReport.find({
      userId,
      reportDate: { $gt: endOfDay },
    })
      .sort({ reportDate: 1 })
      .session(session);

    if (futureReports.length > 0) {
      await recalculateFutureReports(userId, futureReports, session);
    }

    await session.commitTransaction();
    console.log("DEBUG BACKEND SERVICE: Transaction committed successfully");
    return report;
  } catch (error) {
    console.error(
      "DEBUG BACKEND SERVICE: Transaction failed, aborting:",
      error
    );
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Submit a report
 * Marks the report as 'submitted' and validates required fields
 */
const submitDailyReport = async (userId, projectName, reportDate) => {
  // DEBUG 4: What is Mongoose actually about to save?
  console.log("DEBUG BACKEND SERVICE: Submitting report ->", {
    userId,
    projectName,
    reportDate: reportDate.toISOString(),
  });

  try {
    // First, find the existing report to validate it
    const existingReport = await DailyReport.findOne({
      userId,
      projectName,
      reportDate,
    });

    if (!existingReport) {
      throw new Error("Report not found. Please create a report first.");
    }

    // Validate required fields before submitting
    if (!existingReport.activityToday || existingReport.activityToday.trim() === "") {
      throw new Error("Activity Today is required before submitting the report");
    }

    // Update the report with submitted status and timestamp
    existingReport.status = "submitted";
    existingReport.submittedAt = new Date();
    
    await existingReport.save();
    
    console.log("DEBUG BACKEND SERVICE: Report submitted successfully:", existingReport._id);
    return existingReport;
  } catch (error) {
    console.error("DEBUG BACKEND SERVICE: Error submitting report:", error);
    throw error;
  }
};

/**
 * Create a new report with default/empty data
 * Always creates a new report, allows multiple reports per date/project
 */
const createNewReport = async (userId, projectName, reportDate, companyId) => {
  try {
    console.log("DEBUG BACKEND SERVICE: Creating new report for:", {
      userId,
      projectName,
      reportDate,
    });

    // No longer checking for existing reports - allow multiple reports per date/project
    // Create new report with default values
    const report = new DailyReport({
      userId,
      companyId,
      projectName: projectName || "Default Project",
      reportDate,
      status: "draft",
      // Weather fields
      weatherAM: "",
      weatherPM: "",
      tempAM: "",
      tempPM: "",
      currentPeriod: "AM",
      // Activity fields (with empty defaults to satisfy validation)
      activityToday: "",
      workPlanNextDay: "",
      // Resource arrays (empty by default)
      managementTeam: [],
      workingTeamInterior: [],
      workingTeamMEP: [],
      workingTeam: [], // Keep backward compatibility
      materials: [],
      machinery: [],
      // Optional fields for backward compatibility
      weather: "",
      weatherPeriod: "AM",
      temperature: "",
    });

    await report.save();
    
    // 🚀 NEW: Update project statistics
    try {
      const Project = require('../models/projectModel');
      await Project.findOneAndUpdate(
        { 
          name: projectName, 
          isActive: true 
        },
        { 
          $inc: { reportCount: 1 },  // ← Increment count
          $set: { lastReportDate: reportDate }  // ← Update last report date
        },
        { 
          new: true,  // Return updated document
          upsert: false  // Don't create if project doesn't exist
        }
      );
      console.log("DEBUG BACKEND SERVICE: Project stats updated for:", projectName);
    } catch (projectError) {
      console.error("DEBUG BACKEND SERVICE: Failed to update project stats:", projectError);
      // Don't fail the report creation if project update fails
    }
    
    console.log("DEBUG BACKEND SERVICE: New report created with ID:", report._id);
    return report;
  } catch (error) {
    console.error("DEBUG BACKEND SERVICE: Error creating new report:", error);
    throw error;
  }
};

/**
 * Auto-save report (partial update) - optimized for frequent saves
 * Only updates changed fields, maintains rolling totals
 */
const autoSaveReport = async (userId, reportId, partialData) => {
  try {
    console.log("DEBUG BACKEND SERVICE: Auto-saving report:", { userId, reportId });
    
    const session = await DailyReport.startSession();
    session.startTransaction();

    try {
      // Find existing report
      const report = await DailyReport.findOne({ _id: reportId, userId }).session(session);
      
      if (!report) {
        throw new Error("Report not found for auto-save");
      }

      // Only update fields that are provided in partialData
      const updates = {};
      Object.keys(partialData).forEach(key => {
        if (partialData[key] !== undefined) {
          updates[key] = partialData[key];
        }
      });

      // Update timestamp and status if needed
      updates.updatedAt = new Date();
      if (report.status === 'submitted' && partialData.status !== 'submitted') {
        updates.status = 'draft'; // Revert to draft if edited after submitting
      }

      // Apply updates using report.set() to ensure Mongoose change tracking
      report.set(updates);

      await report.save({ session });
      await session.commitTransaction();
      
      console.log("DEBUG BACKEND SERVICE: Auto-save completed:", report._id);
      return report;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error("DEBUG BACKEND SERVICE: Auto-save error:", error);
    throw error;
  }
};

/**
 * Get recent reports for dashboard, sorted by updatedAt
 */
const getRecentReports = async (userId, limit = 20, statusFilter = null) => {
  try {
    const query = { userId };
    
    if (statusFilter) {
      query.status = statusFilter;
    }

    const reports = await DailyReport.find(query)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .select('projectName reportDate status updatedAt createdAt submittedAt');

    return reports;
  } catch (error) {
    console.error("DEBUG BACKEND SERVICE: Error fetching recent reports:", error);
    throw error;
  }
};

/**
 * Create blank draft report immediately (Google Docs style)
 */
const createBlankReport = async (userId, projectName = null) => {
  try {
    console.log("DEBUG BACKEND SERVICE: Creating blank report for:", { userId, projectName });

    const report = new DailyReport({
      userId,
      projectName: projectName || "Untitled Report",
      reportDate: new Date(),
      status: "draft",
      // Minimal default data
      weatherAM: "",
      weatherPM: "",
      tempAM: "",
      tempPM: "",
      currentPeriod: "AM",
      activityToday: "",
      workPlanNextDay: "",
      managementTeam: [],
      workingTeamInterior: [],
      workingTeamMEP: [],
      workingTeam: [], // Keep backward compatibility
      materials: [],
      machinery: [],
    });

    await report.save();
    
    console.log("DEBUG BACKEND SERVICE: Blank report created:", report._id);
    return report;
  } catch (error) {
    console.error("DEBUG BACKEND SERVICE: Error creating blank report:", error);
    throw error;
  }
};

const deleteReport = async (userId, reportId) => {
  try {
    console.log("DEBUG BACKEND SERVICE: Deleting report:", { userId, reportId });
    
    // First get the report to get project name before deletion
    const report = await DailyReport.findOne({
      _id: reportId,
      userId: userId, // Ensure user can only delete their own reports
    });
    
    if (!report) {
      console.log("DEBUG BACKEND SERVICE: Report not found for deletion");
      return null;
    }
    
    // Delete the report
    const result = await DailyReport.findOneAndDelete({
      _id: reportId,
      userId: userId,
    });
    
    // 🚀 NEW: Update project statistics
    try {
      const Project = require('../models/projectModel');
      
      // Get remaining report count for this project
      const remainingReports = await DailyReport.countDocuments({
        projectName: report.projectName  // ← Count ALL reports in project
      });
      
      await Project.findOneAndUpdate(
        { 
          name: report.projectName, 
          isActive: true 
        },
        { 
          $set: { 
            reportCount: Math.max(0, remainingReports),  // ← Update count
            lastReportDate: remainingReports > 0 ? report.reportDate : null  // ← Update or clear date
          }
        },
        { new: true }
      );
      console.log("DEBUG BACKEND SERVICE: Project stats updated after deletion for:", report.projectName);
    } catch (projectError) {
      console.error("DEBUG BACKEND SERVICE: Failed to update project stats after deletion:", projectError);
    }
    
    console.log("DEBUG BACKEND SERVICE: Report deleted successfully");
    return result;
  } catch (error) {
    console.error("DEBUG BACKEND SERVICE: Error deleting report:", error);
    throw error;
  }
};

const getCompanyReports = async (companyId, page = 1, limit = 20, search = "", projectFilter = "") => {
  try {
    const skip = (page - 1) * limit;
    
    // Build search query
    let searchQuery = search ? {
      $and: [
        { companyId },
        { status: "submitted" },  // ← ADD THIS
        {
          $or: [
            { projectName: { $regex: search, $options: "i" } },
            { activityToday: { $regex: search, $options: "i" } },
            { "userId.firstName": { $regex: search, $options: "i" } },
            { "userId.lastName": { $regex: search, $options: "i" } }
          ]
        }
      ]
    } : { 
      companyId,
      status: "submitted"  // ← ADD THIS
    };
    // ADD PROJECT FILTER
    if (projectFilter) {
      searchQuery = {
        $and: [
          searchQuery,
          { projectName: projectFilter }
        ]
      };
    }
    const [reports, total] = await Promise.all([
      DailyReport.find(searchQuery)
        .sort({ reportDate: -1, updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'firstName lastName email'),
      DailyReport.countDocuments(searchQuery)
    ]);
    
    return {
      success: true,
      data: reports,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    };
  } catch (error) {
    console.error("Get company reports error:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  getAllReports,
  getReportById,
  getReportByDate,
  saveOrUpdateReport,
  submitDailyReport,
  createNewReport,
  deleteReport,
  autoSaveReport,
  getRecentReports,
  createBlankReport,
  getCompanyReports,
};
