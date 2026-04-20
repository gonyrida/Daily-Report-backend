const DailyReport = require('../models/dailyReportModel');
const WeeklyReport = require('../models/WeeklyReport');
const { MongoClient } = require('mongodb');
// dotenv.config() is already called in server.js

/**
 * Get the day of week mapping for a given date
 * Maps to the weekly report schema: fri, sat, sun, mon, tue, wed, thu
 * @param {Date} date - The date to map
 * @returns {string} - The corresponding day key
 */
const getDayKey = (date) => {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const dayMap = {
    0: 'sun', // Sunday
    1: 'mon', // Monday
    2: 'tue', // Tuesday
    3: 'wed', // Wednesday
    4: 'thu', // Thursday
    5: 'fri', // Friday
    6: 'sat'  // Saturday
  };
  return dayMap[dayOfWeek];
};

/**
 * Generate all dates for a week range (Friday to Thursday)
 * @param {Date} startDate - Week start date (should be Friday)
 * @param {Date} endDate - Week end date (should be Thursday)
 * @returns {Array} - Array of date objects for each day in the week
 */
const getWeekDates = (startDate, endDate) => {
  const dates = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
};

/**
 * Group manpower resources by description and sum today values
 * @param {Array} dailyReports - Array of daily reports
 * @param {string} teamField - Field name (managementTeam, workingTeamInterior, workingTeamMEP)
 * @returns {Object} - Grouped resources by description
 */
const groupManpowerByDescription = (dailyReports, teamField) => {
  const grouped = {};
  
  dailyReports.forEach(report => {
    const teamResources = report[teamField] || [];
    
    teamResources.forEach(resource => {
      const description = resource.description || 'Unnamed';
      const todayValue = resource.today || 0;
      
      if (!grouped[description]) {
        grouped[description] = {
          description,
          today: 0,
          unit: resource.unit || ''
        };
      }
      
      grouped[description].today += todayValue;
    });
  });
  
  return grouped;
};

/**
 * Map grouped manpower data to weekly report format
 * @param {Object} groupedData - Grouped manpower data
 * @param {Date} startDate - Week start date
 * @param {Date} endDate - Week end date
 * @returns {Array} - Array of weekly report resource objects
 */
const mapToWeeklyFormat = (groupedData, startDate, endDate) => {
  const weekDates = getWeekDates(startDate, endDate);
  const result = [];
  
  // Initialize date structure for each resource
  Object.keys(groupedData).forEach(description => {
    const resource = {
      description,
      date: {
        fri: 0,
        sat: 0,
        sun: 0,
        mon: 0,
        tue: 0,
        wed: 0,
        thu: 0
      },
      prevWeek: 0,
      thisWeek: 0,
      accumulated: 0
    };
    
    result.push(resource);
  });
  
  return result;
};

/**
 * Distribute daily manpower values to weekly format
 * @param {Array} dailyReports - Array of daily reports
 * @param {string} teamField - Field name for the team
 * @param {Date} startDate - Week start date
 * @param {Date} endDate - Week end date
 * @param {Array} weeklyResources - Weekly resource array to populate
 */
const distributeDailyValues = (dailyReports, teamField, startDate, endDate, weeklyResources) => {
  // Create a map for quick lookup of weekly resources by description
  const resourceMap = {};
  weeklyResources.forEach(resource => {
    resourceMap[resource.description] = resource;
  });
  
  // Normalize start/end dates to beginning/end of day for comparison
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  
  dailyReports.forEach((report, index) => {
    const reportDate = new Date(report.reportDate);
    const dayKey = getDayKey(reportDate);
    
    // Normalize report date to midnight for comparison
    const reportDateNormalized = new Date(reportDate);
    reportDateNormalized.setHours(0, 0, 0, 0);
    
    // Skip if this date is outside our week range
    if (reportDateNormalized < start || reportDateNormalized > end) {
      return;
    }
    
    const teamResources = report[teamField] || [];
    
    teamResources.forEach(dailyResource => {
      const description = dailyResource.description || 'Unnamed';
      const todayValue = dailyResource.today || 0;
      
      if (resourceMap[description]) {
        resourceMap[description].date[dayKey] += todayValue;
        resourceMap[description].thisWeek += todayValue;
      }
    });
  });
};

/**
 * Calculate previous week data (optional)
 * @param {string} projectName - Project name
 * @param {Date} currentWeekStart - Current week start date
 * @param {string} teamField - Team field name
 * @returns {Promise<Object>} - Previous week data mapped by description
 */
const getPreviousWeekData = async (projectName, currentWeekStart, teamField) => {
  try {
    // Calculate previous week dates (Friday to Thursday)
    const prevWeekEnd = new Date(currentWeekStart);
    prevWeekEnd.setDate(prevWeekEnd.getDate() - 1); // Thursday before current week
    
    const prevWeekStart = new Date(prevWeekEnd);
    prevWeekStart.setDate(prevWeekStart.getDate() - 6); // Friday of previous week
    
    // Find previous week's weekly report
    const prevWeekReport = await WeeklyReport.findOne({
      projectName,
      startDate: prevWeekStart,
      endDate: prevWeekEnd
    }).lean();
    
    if (!prevWeekReport || !prevWeekReport.sections?.resources?.manPower?.[teamField]) {
      return {};
    }
    
    const prevWeekResources = prevWeekReport.sections.resources.manPower[teamField];
    const prevWeekData = {};
    
    prevWeekResources.forEach(resource => {
      prevWeekData[resource.description] = resource.thisWeek || 0;
    });
    
    return prevWeekData;
  } catch (error) {
    console.error('Error getting previous week data:', error);
    return {};
  }
};

/**
 * Calculate accumulated data (optional)
 * @param {string} projectName - Project name
 * @param {Date} weekEndDate - Current week end date
 * @param {string} teamField - Team field name
 * @returns {Promise<Object>} - Accumulated data mapped by description
 */
const getAccumulatedData = async (projectName, weekEndDate, teamField) => {
  try {
    // Get all daily reports up to current week end
    const allDailyReports = await DailyReport.find({
      projectName,
      reportDate: { $lte: weekEndDate }
    }).select(teamField).lean();
    
    const accumulated = {};
    
    allDailyReports.forEach(report => {
      const teamResources = report[teamField] || [];
      
      teamResources.forEach(resource => {
        const description = resource.description || 'Unnamed';
        const todayValue = resource.today || 0;
        
        if (!accumulated[description]) {
          accumulated[description] = 0;
        }
        
        accumulated[description] += todayValue;
      });
    });
    
    return accumulated;
  } catch (error) {
    console.error('Error getting accumulated data:', error);
    return {};
  }
};

/**
 * Group materials by description and sum today values
 * @param {Array} dailyReports - Array of daily reports
 * @returns {Object} - Grouped materials by description
 */
const groupMaterialsByDescription = (dailyReports) => {
  const grouped = {};
  
  dailyReports.forEach(report => {
    const materials = report.materials || [];
    
    materials.forEach(resource => {
      const description = resource.description || 'Unnamed';
      const todayValue = resource.today || 0;
      
      if (!grouped[description]) {
        grouped[description] = {
          description,
          today: 0,
          unit: resource.unit || ''
        };
      }
      
      grouped[description].today += todayValue;
    });
  });
  
  return grouped;
};

/**
 * Group machinery by description and sum today values
 * @param {Array} dailyReports - Array of daily reports
 * @returns {Object} - Grouped machinery by description
 */
const groupMachineryByDescription = (dailyReports) => {
  const grouped = {};
  
  dailyReports.forEach(report => {
    const machinery = report.machinery || [];
    
    machinery.forEach(resource => {
      const description = resource.description || 'Unnamed';
      const todayValue = resource.today || 0;
      
      if (!grouped[description]) {
        grouped[description] = {
          description,
          today: 0,
          unit: resource.unit || ''
        };
      }
      
      grouped[description].today += todayValue;
    });
  });
  
  return grouped;
};

/**
 * Distribute daily machinery values to weekly format
 * @param {Array} dailyReports - Array of daily reports
 * @param {Date} startDate - Week start date
 * @param {Date} endDate - Week end date
 * @param {Array} weeklyResources - Weekly resource array to populate
 */
const distributeMachineryValues = (dailyReports, startDate, endDate, weeklyResources) => {
  const resourceMap = {};
  weeklyResources.forEach(resource => {
    resourceMap[resource.description] = resource;
  });
  
  // Normalize start/end dates to beginning/end of day for comparison
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  
  dailyReports.forEach(report => {
    const reportDate = new Date(report.reportDate);
    const dayKey = getDayKey(reportDate);
    
    // Normalize report date to midnight for comparison
    const reportDateNormalized = new Date(reportDate);
    reportDateNormalized.setHours(0, 0, 0, 0);
    
    if (reportDateNormalized < start || reportDateNormalized > end) {
      return;
    }
    
    const machinery = report.machinery || [];
    
    machinery.forEach(dailyResource => {
      const description = dailyResource.description || 'Unnamed';
      const todayValue = dailyResource.today || 0;
      
      if (resourceMap[description]) {
        resourceMap[description].date[dayKey] += todayValue;
        resourceMap[description].thisWeek += todayValue;
      }
    });
  });
};

/**
 * Get accumulated materials data up to current week
 * @param {string} projectName - Project name
 * @param {Date} weekEndDate - Current week end date
 * @returns {Promise<Object>} - Accumulated data mapped by description
 */
const getAccumulatedMaterials = async (projectName, weekEndDate) => {
  try {
    const allDailyReports = await DailyReport.find({
      projectName,
      reportDate: { $lte: weekEndDate }
    }).select('materials').lean();
    
    const accumulated = {};
    
    allDailyReports.forEach(report => {
      const materials = report.materials || [];
      
      materials.forEach(resource => {
        const description = resource.description || 'Unnamed';
        const todayValue = resource.today || 0;
        
        if (!accumulated[description]) {
          accumulated[description] = 0;
        }
        
        accumulated[description] += todayValue;
      });
    });
    
    return accumulated;
  } catch (error) {
    console.error('Error getting accumulated materials:', error);
    return {};
  }
};

/**
 * Get previous week materials data
 * @param {string} projectName - Project name
 * @param {Date} currentWeekStart - Current week start date
 * @returns {Promise<Object>} - Previous week data mapped by description
 */
const getPreviousWeekMaterials = async (projectName, currentWeekStart) => {
  try {
    const prevWeekEnd = new Date(currentWeekStart);
    prevWeekEnd.setDate(prevWeekEnd.getDate() - 1);
    
    const prevWeekStart = new Date(prevWeekEnd);
    prevWeekStart.setDate(prevWeekStart.getDate() - 6);
    
    const prevWeekReport = await WeeklyReport.findOne({
      projectName,
      startDate: prevWeekStart,
      endDate: prevWeekEnd
    }).lean();
    
    if (!prevWeekReport || !prevWeekReport.sections?.resources?.material) {
      return {};
    }
    
    const prevWeekMaterials = prevWeekReport.sections.resources.material;
    const prevWeekData = {};
    
    prevWeekMaterials.forEach(resource => {
      prevWeekData[resource.description] = resource.thisWeek || 0;
    });
    
    return prevWeekData;
  } catch (error) {
    console.error('Error getting previous week materials:', error);
    return {};
  }
};

/**
 * Get accumulated machinery data up to current week
 * @param {string} projectName - Project name
 * @param {Date} weekEndDate - Current week end date
 * @returns {Promise<Object>} - Accumulated data mapped by description
 */
const getAccumulatedMachinery = async (projectName, weekEndDate) => {
  try {
    const allDailyReports = await DailyReport.find({
      projectName,
      reportDate: { $lte: weekEndDate }
    }).select('machinery').lean();
    
    const accumulated = {};
    
    allDailyReports.forEach(report => {
      const machinery = report.machinery || [];
      
      machinery.forEach(resource => {
        const description = resource.description || 'Unnamed';
        const todayValue = resource.today || 0;
        
        if (!accumulated[description]) {
          accumulated[description] = 0;
        }
        
        accumulated[description] += todayValue;
      });
    });
    
    return accumulated;
  } catch (error) {
    console.error('Error getting accumulated machinery:', error);
    return {};
  }
};

/**
 * Get previous week machinery data
 * @param {string} projectName - Project name
 * @param {Date} currentWeekStart - Current week start date
 * @returns {Promise<Object>} - Previous week data mapped by description
 */
const getPreviousWeekMachinery = async (projectName, currentWeekStart) => {
  try {
    const prevWeekEnd = new Date(currentWeekStart);
    prevWeekEnd.setDate(prevWeekEnd.getDate() - 1);
    
    const prevWeekStart = new Date(prevWeekEnd);
    prevWeekStart.setDate(prevWeekStart.getDate() - 6);
    
    const prevWeekReport = await WeeklyReport.findOne({
      projectName,
      startDate: prevWeekStart,
      endDate: prevWeekEnd
    }).lean();
    
    if (!prevWeekReport || !prevWeekReport.sections?.resources?.machinery) {
      return {};
    }
    
    const prevWeekMachinery = prevWeekReport.sections.resources.machinery;
    const prevWeekData = {};
    
    prevWeekMachinery.forEach(resource => {
      prevWeekData[resource.description] = resource.thisWeek || 0;
    });
    
    return prevWeekData;
  } catch (error) {
    console.error('Error getting previous week machinery:', error);
    return {};
  }
};

/**
 * Main function to aggregate manpower data from daily to weekly reports
 * @param {string} projectName - Project name
 * @param {Date} startDate - Week start date (Friday)
 * @param {Date} endDate - Week end date (Thursday)
 * @param {Object} options - Options for including prevWeek and accumulated data
 * @returns {Promise<Object>} - Aggregated manpower data for all teams
 */
const aggregateManpowerData = async (projectName, startDate, endDate, options = {}) => {
  const { includePrevWeek = false, includeAccumulated = false } = options;
  
  try {
    // Ensure dates are Date objects
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Validate date range
    if (start >= end) {
      throw new Error('Start date must be before end date');
    }
    
    // Fetch daily reports for the week with direct MongoDB driver for better performance
    console.log(`Fetching daily reports for project: ${projectName}, dates: ${start.toISOString()} to ${end.toISOString()}`);
    
    let dailyReports;
    const client = new MongoClient(process.env.MONGODB_URI);
    
    try {
      await client.connect();
      const db = client.db(); // Use default database from URI
      
      // Normalize dates for MongoDB query - treat as local time (Cambodia UTC+7)
      const queryStart = new Date(start);
      // If date is YYYY-MM-DD format, it's created as UTC midnight. Convert to local midnight.
      if (start.toTimeString() === '00:00:00 GMT') {
        queryStart.setHours(7, 0, 0, 0); // Add 7 hours for Cambodia timezone
      } else {
        queryStart.setHours(0, 0, 0, 0);
      }
      
      const queryEnd = new Date(end);
      // If date is YYYY-MM-DD format, it's created as UTC midnight. Convert to local end of day.
      if (end.toTimeString() === '00:00:00 GMT') {
        queryEnd.setHours(30, 59, 59, 999); // Add 30+ hours to get to end of day (7 + 23)
      } else {
        queryEnd.setHours(23, 59, 59, 999);
      }
      
      dailyReports = await db.collection('dailyreports')
        .find({
          projectName,
          reportDate: {
            $gte: queryStart,
            $lte: queryEnd
          }
        })
        .project({
          reportDate: 1,
          managementTeam: 1,
          workingTeamInterior: 1,
          workingTeamMEP: 1,
          materials: 1,
          machinery: 1,
          _id: 0
        })
        .toArray();
        
      console.log(`Found ${dailyReports.length} daily reports`);
      
    } finally {
      await client.close();
    }
    
    const teamFields = ['managementTeam', 'workingTeamInterior', 'workingTeamMEP'];
    const result = {
      manPower: {},
      material: [],
      machinery: []
    };
    
    for (const teamField of teamFields) {
      // Group daily data by description
      const groupedData = groupManpowerByDescription(dailyReports, teamField);
      
      // Create weekly format structure
      const weeklyResources = mapToWeeklyFormat(groupedData, startDate, endDate);
      
      // Distribute daily values to weekly format
      distributeDailyValues(dailyReports, teamField, start, end, weeklyResources);
      
      // Add previous week data if requested
      if (includePrevWeek) {
        const prevWeekData = await getPreviousWeekData(projectName, startDate, teamField);
        
        weeklyResources.forEach(resource => {
          resource.prevWeek = prevWeekData[resource.description] || 0;
        });
      }
      
      // Add accumulated data if requested
      if (includeAccumulated) {
        const accumulatedData = await getAccumulatedData(projectName, endDate, teamField);
        
        weeklyResources.forEach(resource => {
          resource.accumulated = accumulatedData[resource.description] || 0;
        });
      }
      
      result.manPower[teamField] = weeklyResources;
    }
    
    // Aggregate materials (no daily breakdown)
    const groupedMaterials = groupMaterialsByDescription(dailyReports);
    const weeklyMaterials = Object.keys(groupedMaterials).map(description => ({
      description: groupedMaterials[description].description,
      unit: groupedMaterials[description].unit,
      thisWeek: groupedMaterials[description].today,
      prevWeek: 0,
      accumulated: 0
    }));
    
    // Add previous week data for materials if requested
    if (includePrevWeek) {
      const prevWeekMaterialsData = await getPreviousWeekMaterials(projectName, startDate);
      weeklyMaterials.forEach(resource => {
        resource.prevWeek = prevWeekMaterialsData[resource.description] || 0;
      });
    }
    
    // Add accumulated data for materials if requested
    if (includeAccumulated) {
      const accumulatedMaterialsData = await getAccumulatedMaterials(projectName, endDate);
      weeklyMaterials.forEach(resource => {
        resource.accumulated = accumulatedMaterialsData[resource.description] || 0;
      });
    }
    
    result.material = weeklyMaterials;
    
    // Aggregate machinery (with daily breakdown like manpower)
    const groupedMachinery = groupMachineryByDescription(dailyReports);
    const weeklyMachinery = mapToWeeklyFormat(groupedMachinery, startDate, endDate);
    distributeMachineryValues(dailyReports, start, end, weeklyMachinery);
    
    // Add previous week data for machinery if requested
    if (includePrevWeek) {
      const prevWeekMachineryData = await getPreviousWeekMachinery(projectName, startDate);
      weeklyMachinery.forEach(resource => {
        resource.prevWeek = prevWeekMachineryData[resource.description] || 0;
      });
    }
    
    // Add accumulated data for machinery if requested
    if (includeAccumulated) {
      const accumulatedMachineryData = await getAccumulatedMachinery(projectName, endDate);
      weeklyMachinery.forEach(resource => {
        resource.accumulated = accumulatedMachineryData[resource.description] || 0;
      });
    }
    
    result.machinery = weeklyMachinery;
    
    return {
      success: true,
      data: result,
      message: 'Manpower, materials, and machinery data aggregated successfully'
    };
    
  } catch (error) {
    console.error('Error aggregating manpower data:', error);
    return {
      success: false,
      error: 'Failed to aggregate manpower data',
      details: error.message
    };
  }
};

/**
 * Update weekly report with aggregated manpower data
 * @param {string} reportId - Weekly report ID
 * @param {Object} options - Options for aggregation
 * @returns {Promise<Object>} - Update result
 */
const updateWeeklyReportManpower = async (reportId, options = {}) => {
  try {
    // Get the weekly report
    const weeklyReport = await WeeklyReport.findById(reportId);
    if (!weeklyReport) {
      return {
        success: false,
        error: 'Weekly report not found'
      };
    }
    
    // Aggregate manpower data
    const aggregationResult = await aggregateManpowerData(
      weeklyReport.projectName,
      weeklyReport.startDate,
      weeklyReport.endDate,
      options
    );
    
    if (!aggregationResult.success) {
      return aggregationResult;
    }
    
    // Update the weekly report with aggregated data
    weeklyReport.sections.resources.manPower = aggregationResult.data.manPower;
    weeklyReport.sections.resources.material = aggregationResult.data.material;
    weeklyReport.sections.resources.machinery = aggregationResult.data.machinery;
    weeklyReport.markModified('sections.resources');
    
    await weeklyReport.save();
    
    return {
      success: true,
      data: weeklyReport,
      message: 'Weekly report manpower, materials, and machinery data updated successfully'
    };
    
  } catch (error) {
    console.error('Error updating weekly report manpower:', error);
    return {
      success: false,
      error: 'Failed to update weekly report manpower',
      details: error.message
    };
  }
};

module.exports = {
  aggregateManpowerData,
  updateWeeklyReportManpower,
  getDayKey,
  getWeekDates,
  groupManpowerByDescription,
  groupMaterialsByDescription,
  groupMachineryByDescription,
  mapToWeeklyFormat,
  distributeDailyValues,
  distributeMachineryValues,
  getPreviousWeekData,
  getPreviousWeekMaterials,
  getPreviousWeekMachinery,
  getAccumulatedData,
  getAccumulatedMaterials,
  getAccumulatedMachinery
};
