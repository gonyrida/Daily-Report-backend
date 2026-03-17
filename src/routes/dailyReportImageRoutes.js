// src/routes/dailyReportImageRoutes.js
// Routes for daily report image operations

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const {
  uploadReportImages,
  moveTempFiles,
  cleanupImages,
  getReportImages
} = require('../controllers/dailyReportImageController');

// Upload images for a specific report section
router.post('/reports/:reportId/images/:imageType', authenticateToken, uploadReportImages);

// Move temp files to permanent location when report is saved
router.post('/reports/move-temp-files', authenticateToken, moveTempFiles);

// Clean up unused images
router.post('/reports/:reportId/cleanup-images', authenticateToken, cleanupImages);

// Get all image metadata for a report
router.get('/reports/:reportId/images', authenticateToken, getReportImages);

module.exports = router;
