const WeeklyReport = require('../models/WeeklyReport');

/**
 * Save construction progress data to a weekly report
 */
const saveConstructionProgress = async (reportId, userId, constructionData) => {
  try {
    // Validate input
    if (!reportId || !userId || !constructionData) {
      return {
        success: false,
        error: 'Missing required fields: reportId, userId, or constructionData'
      };
    }

    // Verify the report exists and belongs to the user
    const report = await WeeklyReport.findOne({ _id: reportId, userId });
    if (!report) {
      return {
        success: false,
        error: 'Report not found or access denied'
      };
    }

    // Update the construction progress section
    const updatedReport = await WeeklyReport.findByIdAndUpdate(
      reportId,
      {
        $set: {
          'sections.constructionProgress': constructionData,
          updatedAt: new Date()
        }
      },
      { new: true, runValidators: false }
    );

    if (!updatedReport) {
      return {
        success: false,
        error: 'Failed to update construction progress'
      };
    }

    return {
      success: true,
      data: updatedReport.sections.constructionProgress,
      message: 'Construction progress saved successfully'
    };
  } catch (error) {
    console.error('Error saving construction progress:', error);
    return {
      success: false,
      error: 'Internal server error',
      details: error.message
    };
  }
};

/**
 * Get construction progress data from a weekly report
 */
const getConstructionProgress = async (reportId, userId) => {
  try {
    if (!reportId || !userId) {
      return {
        success: false,
        error: 'Missing required fields: reportId or userId'
      };
    }

    const report = await WeeklyReport.findOne(
      { _id: reportId, userId },
      { 'sections.constructionProgress': 1 }
    );

    if (!report) {
      return {
        success: false,
        error: 'Report not found or access denied'
      };
    }

    return {
      success: true,
      data: report.sections?.constructionProgress || {
        projectInfo: {
          project: "",
          subtitle: "",
          date: "",
          revision: ""
        },
        items: []
      },
      message: 'Construction progress retrieved successfully'
    };
  } catch (error) {
    console.error('Error getting construction progress:', error);
    return {
      success: false,
      error: 'Internal server error',
      details: error.message
    };
  }
};

/**
 * Delete construction progress data from a weekly report
 */
const deleteConstructionProgress = async (reportId, userId) => {
  try {
    if (!reportId || !userId) {
      return {
        success: false,
        error: 'Missing required fields: reportId or userId'
      };
    }

    // Verify the report exists and belongs to the user
    const report = await WeeklyReport.findOne({ _id: reportId, userId });
    if (!report) {
      return {
        success: false,
        error: 'Report not found or access denied'
      };
    }

    // Remove the construction progress section
    const updatedReport = await WeeklyReport.findByIdAndUpdate(
      reportId,
      {
        $unset: { 'sections.constructionProgress': "" },
        updatedAt: new Date()
      },
      { new: true }
    );

    return {
      success: true,
      message: 'Construction progress deleted successfully'
    };
  } catch (error) {
    console.error('Error deleting construction progress:', error);
    return {
      success: false,
      error: 'Internal server error',
      details: error.message
    };
  }
};

/**
 * Validate construction progress data structure
 */
const validateConstructionProgressData = (data) => {
  const errors = [];

  if (!data || typeof data !== 'object') {
    errors.push('Construction progress data must be an object');
    return errors;
  }

  // Validate projectInfo
  if (!data.projectInfo || typeof data.projectInfo !== 'object') {
    errors.push('projectInfo is required and must be an object');
  } else {
    const requiredFields = ['project', 'subtitle', 'date', 'revision'];
    requiredFields.forEach(field => {
      if (typeof data.projectInfo[field] !== 'string') {
        errors.push(`projectInfo.${field} must be a string`);
      }
    });
  }

  // Validate items array
  if (!Array.isArray(data.items)) {
    errors.push('items must be an array');
  } else {
    data.items.forEach((item, index) => {
      if (!item.id || typeof item.id !== 'string') {
        errors.push(`Item ${index}: id is required and must be a string`);
      }

      // Validate BoQ data
      if (!item.boQ || typeof item.boQ !== 'object') {
        errors.push(`Item ${index}: boQ is required and must be an object`);
      } else {
        const boqFields = ['qty', 'materialRate', 'laborRate', 'unitRate', 'amount'];
        boqFields.forEach(field => {
          if (typeof item.boQ[field] !== 'number') {
            errors.push(`Item ${index}: boQ.${field} must be a number`);
          }
        });
      }

      // Validate progress data objects
      const progressFields = ['previousWeek', 'thisWeek', 'upToThisWeek', 'remaining', 'nextWeekPlan', 'upToNextWeekPlan'];
      progressFields.forEach(field => {
        if (!item[field] || typeof item[field] !== 'object') {
          errors.push(`Item ${index}: ${field} is required and must be an object`);
        } else {
          const progressDataFields = ['qty', 'amount', 'percentage'];
          progressDataFields.forEach(subField => {
            if (typeof item[field][subField] !== 'number') {
              errors.push(`Item ${index}: ${field}.${subField} must be a number`);
            }
          });
        }
      });
    });
  }

  return errors;
};

module.exports = {
  saveConstructionProgress,
  getConstructionProgress,
  deleteConstructionProgress,
  validateConstructionProgressData
};
