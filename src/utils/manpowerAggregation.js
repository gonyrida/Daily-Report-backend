const DailyReport = require('../models/dailyReportModel');
const WeeklyReport = require('../models/WeeklyReport');
const { MongoClient } = require('mongodb');
const { MONGODB_URI } = require('../config/env');

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
  
  dailyReports.forEach(report => {
    const reportDate = new Date(report.reportDate);
    const dayKey = getDayKey(reportDate);
    
    // Skip if this date is outside our week range
    if (reportDate < startDate || reportDate > endDate) {
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
    // Validate date range
    if (startDate >= endDate) {
      throw new Error('Start date must be before end date');
    }
    
    // Fetch daily reports for the week with direct MongoDB driver for better performance
    console.log(`Fetching daily reports for project: ${projectName}, dates: ${startDate} to ${endDate}`);
    
    let dailyReports;
    const client = new MongoClient(MONGODB_URI);
    
    try {
      await client.connect();
      const db = client.db(); // Use default database from URI
      
      dailyReports = await db.collection('dailyreports')
        .find({
          projectName,
          reportDate: {
            $gte: startDate,
            $lte: endDate
          }
        })
        .project({
          reportDate: 1,
          managementTeam: 1,
          workingTeamInterior: 1,
          workingTeamMEP: 1,
          _id: 0
        })
        .toArray();
        
      console.log(`Found ${dailyReports.length} daily reports`);
      
    } finally {
      await client.close();
    }
    
    const teamFields = ['managementTeam', 'workingTeamInterior', 'workingTeamMEP'];
    const result = {
      manPower: {}
    };
    
    for (const teamField of teamFields) {
      // Group daily data by description
      const groupedData = groupManpowerByDescription(dailyReports, teamField);
      
      // Create weekly format structure
      const weeklyResources = mapToWeeklyFormat(groupedData, startDate, endDate);
      
      // Distribute daily values to weekly format
      distributeDailyValues(dailyReports, teamField, startDate, endDate, weeklyResources);
      
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
    
    return {
      success: true,
      data: result,
      message: 'Manpower data aggregated successfully'
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
    weeklyReport.markModified('sections.resources.manPower');
    
    await weeklyReport.save();
    
    return {
      success: true,
      data: weeklyReport,
      message: 'Weekly report manpower data updated successfully'
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
  mapToWeeklyFormat,
  distributeDailyValues,
  getPreviousWeekData,
  getAccumulatedData
};
