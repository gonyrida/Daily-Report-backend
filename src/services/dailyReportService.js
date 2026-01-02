const DailyReport = require("../models/dailyReportModel.js");

/**
 * Get all reports
 */
const getAllReports = async () => {
  return await DailyReport.find().sort({ reportDate: -1 });
};

/**
 * Get a single report by projectName + date
 */
const getReportByDate = async (projectName, reportDate) => {
  // Create date range for the entire day
  const inputDate = new Date(reportDate);

  const startOfDay = new Date(Date.UTC(
    inputDate.getUTCFullYear(),
    inputDate.getUTCMonth(),
    inputDate.getUTCDate(),
    0, 0, 0, 0
  ));

  const endOfDay = new Date(Date.UTC(
    inputDate.getUTCFullYear(),
    inputDate.getUTCMonth(),
    inputDate.getUTCDate(),
    23, 59, 59, 999
  ));

  console.log("Searching for report with:", {
    projectName,
    startOfDay: startOfDay.toISOString(),
    endOfDay: endOfDay.toISOString(),
  });

  const report = await DailyReport.findOne({
    projectName,
    reportDate: {
      $gte: startOfDay,
      $lte: endOfDay,
    },
  });

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

  const startOfDay = new Date(Date.UTC(
    inputDate.getUTCFullYear(),
    inputDate.getUTCMonth(),
    inputDate.getUTCDate(),
    0, 0, 0, 0
  ));

  const endOfDay = new Date(Date.UTC(
    inputDate.getUTCFullYear(),
    inputDate.getUTCMonth(),
    inputDate.getUTCDate(),
    23, 59, 59, 999
  ));

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
 * Save or update a report
 * If a report exists for the same project + date, update it
 * Otherwise, create a new report
 */
const saveOrUpdateReport = async (reportData) => {
  const { projectName, reportDate } = reportData;
  const inputDate = new Date(reportDate);

  // Set search window strictly in UTC
  const startOfDay = new Date(inputDate);
  startOfDay.setUTCHours(0, 0, 0, 0);

  const endOfDay = new Date(inputDate);
  endOfDay.setUTCHours(23, 59, 59, 999);

  let report = await DailyReport.findOne({
    projectName,
    reportDate: { $gte: startOfDay, $lte: endOfDay },
  });

  if (report) {
    report.set(reportData);
    report.reportDate = inputDate; // Normalized UTC date from controller
    await report.save();
  } else {
    report = new DailyReport({ ...reportData, reportDate: inputDate, status: "draft" });
    await report.save();
  }
  return report;
};

/**
 * Submit a report
 * Marks the report as 'submitted'
 */
const submitDailyReport = async (projectName, reportDate) => {
  // DEBUG 4: What is Mongoose actually about to save?
  console.log("DEBUG BACKEND SERVICE: Saving to DB ->", { 
    projectName, 
    reportDate: reportDate.toISOString() 
  });

  // We use "upsert: true" so it creates the report if it's missing
  const report = await DailyReport.findOneAndUpdate(
    { projectName, reportDate }, 
    { 
      status: 'submitted', 
      submittedAt: new Date() 
    },
    { 
      new: true,    // Return the updated document to the controller
      upsert: true,  // Create it if it doesn't exist (prevents 404)
      setDefaultsOnInsert: true
    }
  );
  
  return report;
};

/**
 * Create a new report with rolling totals
 */
const createReport = async (reportData) => {
  const { projectName, reportDate } = reportData;

  if (!projectName || !reportDate) {
    throw new Error("projectName and reportDate are required");
  }

  // Normalize the incoming reportDate to UTC Midnight
  // This prevents the "Date Shift" when saving from different timezones
  const d = new Date(reportDate);
  const normalizedDate = new Date(Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    0, 0, 0, 0
  ));
  
  // Update the reportData with the clean UTC date
  reportData.reportDate = normalizedDate;

  // Fetch the previous report for the same project
  const previousReport = await DailyReport.findOne({ projectName })
    .sort({ reportDate: -1 });

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
