const DailyReport = require("../models/dailyReportModel.js");
/**
 * Recalculate rolling totals for future reports when a past report is edited
 */
const recalculateFutureReports = async (userId, projectName, futureReports, session) => {
  for (let i = 0; i < futureReports.length; i++) {
    const currentReport = futureReports[i];

    // Get the previous report (either the one before this in the list or the last before the edited date)
    const previousReport =
      i > 0
        ? futureReports[i - 1]
        : await DailyReport.findOne({
            userId,
            projectName,  // ← Also filter by project for consistency
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
const getReportById = async (userId, reportId) => {
  return await DailyReport.findOne({ _id: reportId, userId });
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
 * Upsert daily report with proper update/insert logic
 * If report exists for same project and date: update it and set lastUpdated
 * If report doesn't exist: insert as new record
 */
const upsertDailyReport = async (userId, reportData) => {
  console.log("DEBUG BACKEND SERVICE: upsertDailyReport called with:", {
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

    // Find existing report for this user, project, and date
    let report = await DailyReport.findOne({
      userId,
      projectName,
      reportDate: { $gte: startOfDay, $lte: endOfDay },
    }).session(session);

    console.log(
      "DEBUG BACKEND SERVICE: Existing report found:",
      report ? "YES" : "NO"
    );

    // 🔥 FIX #1: Get the previous report with projectName filter
    const previousReport = await DailyReport.findOne({
      userId,
      projectName,  // ← CRITICAL FIX: Must match same project!
      reportDate: { $lt: startOfDay },
    })
      .sort({ reportDate: -1 })
      .session(session);

    console.log("DEBUG BACKEND SERVICE: Previous report found:", {
      found: previousReport ? "YES" : "NO",
      previousDate: previousReport?.reportDate?.toISOString(),
      previousProjectName: previousReport?.projectName
    });

    // 🔥 FIX #3: Enhanced rolling totals with validation
    const calculateRollingTotals = (newItems, previousItems = []) => {
      // First, merge any duplicate descriptions in current day's data
      const uniqueNewItems = mergeDuplicateDescriptions(newItems);
      
      return uniqueNewItems.map((item) => {
        const prevItem = previousItems.find(
          (p) => p.description?.trim() === item.description?.trim()
        );
        
        const prevAccum = Number(prevItem?.accumulated) || 0;
        const today = Number(item.today) || 0;
        const accumulated = prevAccum + today;
        
        // Validation logging
        console.log(`DEBUG: Rolling total for "${item.description}":`, {
          prev: prevAccum,
          today: today,
          accumulated: accumulated,
          foundPrevious: !!prevItem
        });
        
        return {
          ...item,
          prev: prevAccum,
          today: today, // Ensure it's a number
          accumulated: accumulated,
        };
      });
    };

    // Helper function to handle text field updates
    const updateTextField = (existingValue, newValue, strategy = 'replace') => {
      if (strategy === 'append' && existingValue && newValue) {
        // Avoid duplicate content when appending
        if (existingValue.includes(newValue)) {
          return existingValue;
        }
        return existingValue + '\n' + newValue;
      }
      return newValue !== undefined ? newValue : existingValue;
    };

    // Helper function to handle numeric field updates
    const updateNumericField = (existingValue, newValue) => {
      if (newValue !== undefined && newValue !== null && newValue !== '') {
        const parsed = Number(newValue);
        return isNaN(parsed) ? existingValue : parsed;
      }
      return existingValue;
    };

    // Calculate rolling totals for all resource arrays
    console.log("DEBUG: Calculating rolling totals for managementTeam...");
    const managementTeam = calculateRollingTotals(
      reportData.managementTeam || [],
      previousReport?.managementTeam || []
    );

    console.log("DEBUG: Calculating rolling totals for workingTeamInterior...");
    const workingTeamInterior = calculateRollingTotals(
      reportData.workingTeamInterior || [],
      previousReport?.workingTeamInterior || []
    );

    console.log("DEBUG: Calculating rolling totals for workingTeamMEP...");
    const workingTeamMEP = calculateRollingTotals(
      reportData.workingTeamMEP || [],
      previousReport?.workingTeamMEP || []
    );

    // Keep backward compatibility for old workingTeam
    const workingTeam = calculateRollingTotals(
      reportData.workingTeam || [],
      previousReport?.workingTeam || []
    );

    console.log("DEBUG: Calculating rolling totals for materials...");
    const materials = calculateRollingTotals(
      reportData.materials || [],
      previousReport?.materials || []
    );

    console.log("DEBUG: Calculating rolling totals for machinery...");
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
      
      // Define field update strategies
      const numericFields = ['tempAM', 'tempPM'];
      
      const textFields = [
        { name: 'activityToday', strategy: 'append' },
        { name: 'workPlanNextDay', strategy: 'replace' },
        { name: 'weatherAM', strategy: 'replace' },
        { name: 'weatherPM', strategy: 'replace' },
        { name: 'hse_title', strategy: 'replace' },
        { name: 'site_title', strategy: 'replace' },
        { name: 'description', strategy: 'replace' },
        { name: 'tableTitle', strategy: 'replace' }
      ];
      
      const updateData = {
        ...reportData,
        managementTeam,
        workingTeamInterior,
        workingTeamMEP,
        workingTeam, // Keep backward compatibility
        materials,
        machinery,
        reportDate: inputDate,
        lastUpdated: new Date(), // Update timestamp
      };
      
      // Apply numeric field updates
      numericFields.forEach(field => {
        if (reportData[field] !== undefined) {
          updateData[field] = updateNumericField(report[field], reportData[field]);
        }
      });
      
      // Apply text field update strategies
      textFields.forEach(({ name, strategy }) => {
        if (reportData[name] !== undefined) {
          updateData[name] = updateTextField(report[name], reportData[name], strategy);
        }
      });
      
      report.set(updateData);
      await report.save({ session });
      console.log("DEBUG BACKEND SERVICE: Report updated successfully");
    } else {
      // Create new report
      console.log("DEBUG BACKEND SERVICE: Creating new report");
      report = new DailyReport({
        userId,
        ...reportData,
        managementTeam,
        workingTeamInterior,
        workingTeamMEP,
        workingTeam, // Keep backward compatibility
        materials,
        machinery,
        reportDate: inputDate,
        status: "draft",
        lastUpdated: new Date(),
      });
      await report.save({ session });
      console.log(
        "DEBUG BACKEND SERVICE: New report created with ID:",
        report._id
      );
    }

    // Check if there are future reports that need recalculation
    const futureReports = await DailyReport.find({
      userId,
      projectName,  // ← Also filter future reports by project
      reportDate: { $gt: endOfDay },
    })
      .sort({ reportDate: 1 })
      .session(session);

    if (futureReports.length > 0) {
      console.log(`DEBUG: Recalculating ${futureReports.length} future reports...`);
      await recalculateFutureReports(userId, projectName, futureReports, session);
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
const createNewReport = async (userId, projectName, reportDate) => {
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
    
    const result = await DailyReport.findOneAndDelete({
      _id: reportId,
      userId: userId, // Ensure user can only delete their own reports
    });
    
    if (!result) {
      console.log("DEBUG BACKEND SERVICE: Report not found for deletion");
      return null;
    }
    
    console.log("DEBUG BACKEND SERVICE: Report deleted successfully");
    return result;
  } catch (error) {
    console.error("DEBUG BACKEND SERVICE: Error deleting report:", error);
    throw error;
  }
};

module.exports = {
  getAllReports,
  getReportById,
  getReportByDate,
  upsertDailyReport,
  submitDailyReport,
  createNewReport,
  deleteReport,
  autoSaveReport,
  getRecentReports,
  createBlankReport,
};
