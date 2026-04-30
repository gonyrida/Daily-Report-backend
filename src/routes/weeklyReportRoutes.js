const express = require('express');
const router = express.Router();
const weeklyReportService = require('../services/weeklyReportService');
const { convertPdfToImages, convertPdfToImagesStandalone } = require('../services/pdfConversionService');
const {
  getWeeklyReports,
  getWeeklyReportsMeta,
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
  aggregateManpower,
  updateReportManpower,
  aggregateImages,
  updateReportImages,
  getCompanyWeeklyReports
} = require('../controllers/weeklyReportController');

// GET /api/weekly-reports - Get all weekly reports for user
router.get('/', getWeeklyReports);

// GET /api/weekly-reports/company - Get company-wide submitted weekly reports
router.get('/company', getCompanyWeeklyReports);

// GET /api/weekly-reports/meta - Get weekly reports metadata (lightweight)
router.get('/meta', getWeeklyReportsMeta);

// GET /api/weekly-reports/template - Get weekly report template
router.get('/template', getWeeklyReportTemplate);

// Construction Progress Routes - MUST come before /:id route
// GET /api/weekly-reports/:id/construction-progress
router.get('/:id/construction-progress', (req, res, next) => {
  next();
}, require('../controllers/constructionProgressController').getConstructionProgress);

// POST /api/weekly-reports/:id/construction-progress  
router.post('/:id/construction-progress', require('../controllers/constructionProgressController').saveConstructionProgress);

// PUT /api/weekly-reports/:id/construction-progress
router.put('/:id/construction-progress', require('../controllers/constructionProgressController').saveConstructionProgress);

// DELETE /api/weekly-reports/:id/construction-progress
router.delete('/:id/construction-progress', require('../controllers/constructionProgressController').deleteConstructionProgress);

// GET /api/weekly-reports/aggregate-images - Aggregate images from daily reports (preview only) - MUST come before /:id
router.get('/aggregate-images', aggregateImages);

// POST /api/weekly-reports/aggregate-manpower - Aggregate manpower data - MUST come before /:id
router.post('/aggregate-manpower', aggregateManpower);

// GET /api/weekly-reports/:id - Get single weekly report (MUST come after specific routes)
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

    const result = await weeklyReportService.updateSection(id, userId, 'overallProgress', updateData);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        message: 'Overall progress section updated successfully'
      });
    } else {
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

// PATCH /api/weekly-reports/:id/qaqc-status - Update QAQC section
router.patch('/:id/qaqc-status', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const updateData = req.body;

    const result = await weeklyReportService.updateSection(id, userId, 'qaqcStatus', updateData);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        message: 'QAQC section updated successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        details: result.details
      });
    }
  } catch (error) {
    console.error('Controller error in updateQaqcStatus:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// PATCH /api/weekly-reports/:id/master-schedule - Update master schedule section
router.patch('/:id/master-schedule', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const updateData = req.body;

    const result = await weeklyReportService.updateSection(id, userId, 'masterSchedule', updateData);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        message: 'Master schedule section updated successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        details: result.details
      });
    }
  } catch (error) {
    console.error('❌ Controller error in updateMasterSchedule:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// POST /api/weekly-reports/:id/validate - Validate weekly report
router.post('/:id/validate', validateWeeklyReport);

// POST /api/weekly-reports/:id/update-manpower - Update report with aggregated manpower
router.post('/:id/update-manpower', updateReportManpower);

// POST /api/weekly-reports/:id/update-images - Update report with aggregated images
router.post('/:id/update-images', updateReportImages);

// POST /api/weekly-reports/:id/master-schedule/:entryId/convert-pdf - Convert PDF to images
router.post('/:id/master-schedule/:entryId/convert-pdf', async (req, res) => {
  try {
    const { id: reportId, entryId } = req.params;
    const userId = req.user.userId;
    const { pdfUrl } = req.body;

    if (!pdfUrl) {
      return res.status(400).json({
        success: false,
        error: 'PDF URL is required'
      });
    }

    console.log(`[API] PDF conversion request - Report: ${reportId}, Entry: ${entryId}`);

    // Start conversion
    const result = await convertPdfToImages(pdfUrl, reportId, entryId, userId);

    if (result.success) {
      return res.status(200).json({
        success: true,
        data: {
          entryId,
          images: result.images,
          pageCount: result.pageCount
        },
        message: `Successfully converted PDF to ${result.pageCount} images`
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error || 'PDF conversion failed'
      });
    }

  } catch (error) {
    console.error('[API] PDF conversion error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error during PDF conversion'
    });
  }
});

// POST /api/weekly-reports/convert-pdf-standalone - Convert PDF without saving report
router.post('/convert-pdf-standalone', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { pdfUrl, tempId } = req.body;

    if (!pdfUrl) {
      return res.status(400).json({
        success: false,
        error: 'PDF URL is required'
      });
    }

    console.log(`[API] Standalone PDF conversion request - tempId: ${tempId}`);

    // Start conversion without updating database
    const result = await convertPdfToImagesStandalone(pdfUrl, tempId || 'unsaved', userId);

    if (result.success) {
      return res.status(200).json({
        success: true,
        data: {
          images: result.images,
          pageCount: result.pageCount
        },
        message: `Successfully converted PDF to ${result.pageCount} images`
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error || 'PDF conversion failed'
      });
    }

  } catch (error) {
    console.error('[API] Standalone PDF conversion error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error during PDF conversion'
    });
  }
});

module.exports = router;
