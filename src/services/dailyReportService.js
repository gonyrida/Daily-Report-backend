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
 * Get a report by date only (no projectName required) - DEPRECATED
 * This function is insecure and should not be used
 */
const getReportByDateOnly = async (reportDate) => {
  throw new Error("getReportByDateOnly is deprecated for security reasons. Use getReportByDate with userId instead.");
};

/**
 * Save or update a report with rolling totals recalculation
 * Uses transactions to prevent race conditions
 */
const saveOrUpdateReport = async (userId, reportData) => {
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
        managementTeam,
        workingTeam,
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
        ...reportData,
        managementTeam,
        workingTeam,
        materials,
        machinery,
        reportDate: inputDate,
        status: "draft",
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
 * Marks the report as 'submitted'
 */
const submitDailyReport = async (userId, projectName, reportDate) => {
  // DEBUG 4: What is Mongoose actually about to save?
  console.log("DEBUG BACKEND SERVICE: Saving to DB ->", {
    userId,
    projectName,
    reportDate: reportDate.toISOString(),
  });

  // We use "upsert: true" so it creates the report if it's missing
  const report = await DailyReport.findOneAndUpdate(
    { userId, projectName, reportDate },
    {
      status: "submitted",
      submittedAt: new Date(),
    },
    {
      new: true, // Return the updated document to the controller
      upsert: true, // Create it if it doesn't exist (prevents 404)
      setDefaultsOnInsert: true,
    }
  );

  return report;
};

/**
 * Create a new report with rolling totals for a specific user
 */
const createReport = async (userId, reportData) => {
  if (!userId) {
    throw new Error("userId is required");
  }
  
  const { projectName, reportDate } = reportData;

  if (!projectName || !reportDate) {
    throw new Error("projectName and reportDate are required");
  }

  // Normalize the incoming reportDate to UTC Midnight
  const d = new Date(reportDate);
  const normalizedDate = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0)
  );

  // Update the reportData with the clean UTC date
  reportData.reportDate = normalizedDate;

  // Fetch the previous report for the same user and project
  const previousReport = await DailyReport.findOne({ userId, projectName }).sort({
    reportDate: -1,
  });

  // Helper function to calculate rolling totals for one array
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

  // Process all arrays
  const managementTeam = calculateRollingTotals(
    reportData.managementTeam || [],
    previousReport?.managementTeam || []
  );

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

  // Create the new report with calculated totals
  const report = new DailyReport({
    userId,
    ...reportData,
    managementTeam,
    workingTeam,
    materials,
    machinery,
    status: "draft", // keep draft initially
  });

  return await report.save();
};

module.exports = {
  getAllReports,
  getReportByDate,
  getReportByDateOnly,
  saveOrUpdateReport,
  submitDailyReport,
  createReport,
};
