const express = require('express');
const router = express.Router();
const weeklyReportService = require('../services/weeklyReportService');
const {
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
  validateWeeklyReport
} = require('../controllers/weeklyReportController');

// GET /api/weekly-reports - Get all weekly reports for user
router.get('/', getWeeklyReports);

// GET /api/weekly-reports/template - Get weekly report template
router.get('/template', getWeeklyReportTemplate);

// GET /api/weekly-reports/:id - Get single weekly report
router.get('/:id', getWeeklyReportById);

// POST /api/weekly-reports - Create new weekly report
router.post('/', createWeeklyReport);

// PUT /api/weekly-reports/:id - Update weekly report
router.put('/:id', updateWeeklyReport);

// DELETE /api/weekly-reports/:id - Delete weekly report
router.delete('/:id', deleteWeeklyReport);

// POST /api/weekly-reports/:id/submit - Submit weekly report
router.post('/:id/submit', submitWeeklyReport);

// POST /api/weekly-reports/:id/approve - Approve weekly report
router.post('/:id/approve', approveWeeklyReport);

// POST /api/weekly-reports/:id/reject - Reject weekly report
router.post('/:id/reject', rejectWeeklyReport);

// PATCH /api/weekly-reports/:id/auto-save - Auto-save weekly report
// router.patch('/:id/auto-save', autoSaveWeeklyReport);

// PATCH /api/weekly-reports/:id/introduction - Update introduction section
router.patch('/:id/introduction', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const updateData = req.body;

    const result = await weeklyReportService.updateSection(id, userId, 'introduction', updateData);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        message: 'Introduction section updated successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        details: result.details
      });
    }
  } catch (error) {
    console.error('Controller error in updateIntroduction:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// PATCH /api/weekly-reports/:id/activities - Update activities section
router.patch('/:id/activities', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const updateData = req.body;

    const result = await weeklyReportService.updateSection(id, userId, 'activities', updateData);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        message: 'Activities section updated successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        details: result.details
      });
    }
  } catch (error) {
    console.error('Controller error in updateActivities:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// PATCH /api/weekly-reports/:id/hses - Update HSE section
router.patch('/:id/hses', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const updateData = req.body;

    const result = await weeklyReportService.updateSection(id, userId, 'hses', updateData);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        message: 'HSE section updated successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        details: result.details
      });
    }
  } catch (error) {
    console.error('Controller error in updateHses:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// PATCH /api/weekly-reports/:id/resources - Update resources section
router.patch('/:id/resources', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const updateData = req.body;

    const result = await weeklyReportService.updateSection(id, userId, 'resources', updateData);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        message: 'Resources section updated successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        details: result.details
      });
    }
  } catch (error) {
    console.error('Controller error in updateResources:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// PATCH /api/weekly-reports/:id/overall-progress - Update overall progress section
router.patch('/:id/overall-progress', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const updateData = req.body;

    console.log(`🔧 DEBUG ROUTE: PATCH /api/weekly-reports/${id}/overall-progress`);
    console.log(`🔧 DEBUG ROUTE: userId=${userId}`);
    console.log(`🔧 DEBUG ROUTE: updateData=`, JSON.stringify(updateData, null, 2));

    const result = await weeklyReportService.updateSection(id, userId, 'overallProgress', updateData);

    if (result.success) {
      console.log(`✅ DEBUG ROUTE: Successfully updated overall progress`);
      res.status(200).json({
        success: true,
        data: result.data,
        message: 'Overall progress section updated successfully'
      });
    } else {
      console.log(`❌ DEBUG ROUTE: Failed to update overall progress - ${result.error}`);
      res.status(400).json({
        success: false,
        error: result.error,
        details: result.details
      });
    }
  } catch (error) {
    console.error('❌ Controller error in updateOverallProgress:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// POST /api/weekly-reports/:id/duplicate - Duplicate weekly report
// router.post('/:id/duplicate', duplicateWeeklyReport);

// POST /api/weekly-reports/:id/validate - Validate weekly report
router.post('/:id/validate', validateWeeklyReport);

module.exports = router;
