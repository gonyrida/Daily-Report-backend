const constructionProgressService = require('../services/constructionProgressService');

/**
 * Save construction progress data for a weekly report
 */
const saveConstructionProgress = async (req, res) => {
  try {
    const { reportId } = req.params;
    const userId = req.user.userId;
    const constructionData = req.body;

    // Validate the construction progress data
    const validationErrors = constructionProgressService.validateConstructionProgressData(constructionData);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationErrors
      });
    }

    const result = await constructionProgressService.saveConstructionProgress(reportId, userId, constructionData);

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
    console.error('Controller error in saveConstructionProgress:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Get construction progress data for a weekly report
 */
const getConstructionProgress = async (req, res) => {
  try {
    const { reportId } = req.params;
    const userId = req.user.userId;

    const result = await constructionProgressService.getConstructionProgress(reportId, userId);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        message: result.message
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Controller error in getConstructionProgress:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Delete construction progress data for a weekly report
 */
const deleteConstructionProgress = async (req, res) => {
  try {
    const { reportId } = req.params;
    const userId = req.user.userId;

    const result = await constructionProgressService.deleteConstructionProgress(reportId, userId);

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
    console.error('Controller error in deleteConstructionProgress:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

module.exports = {
  saveConstructionProgress,
  getConstructionProgress,
  deleteConstructionProgress
};
