// src/controllers/dailyReportImageController.js
// Controller for handling daily report image operations

const dailyReportImageService = require('../services/dailyReportImageService');
const DailyReport = require('../models/dailyReportModel');

/**
 * Upload images for a daily report
 */
const uploadReportImages = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { imageType, imageData } = req.body;
    const userId = req.user.userId;


    if (!imageData || !Array.isArray(imageData)) {
      return res.status(400).json({ error: 'Invalid image data format' });
    }

    const result = await dailyReportImageService.processImageUploads(
      reportId, userId, imageData, imageType
    );

    if (result.success) {
      res.json({
        success: true,
        images: result.images,
        hasTempFiles: result.hasTempFiles
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Image upload failed',
        errors: result.errors
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Move temp files to permanent location when report is saved
 */
const moveTempFiles = async (req, res) => {
  try {
    const { tempReportId, finalReportId } = req.body;
    const userId = req.user.userId;


    const result = await dailyReportImageService.moveTempFilesOnSave(
      tempReportId, finalReportId, userId
    );

    if (result.success) {
      res.json({
        success: true,
        movedFiles: result.movedFiles
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to move temp files',
        details: result.error
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Clean up unused images
 */
const cleanupImages = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { currentImages, newImages } = req.body;


    const result = await dailyReportImageService.cleanupUnusedImages(
      currentImages, newImages
    );

    if (result.success) {
      res.json({
        success: true,
        deletedCount: result.deletedCount,
        failedCount: result.failedCount
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Cleanup failed',
        errors: result.errors
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get image metadata for a report
 */
const getReportImages = async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await DailyReport.findById(reportId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Collect all image metadata
    const images = {
      projectLogo: report.projectLogo,
      hse: report.hse || [],
      site_ref: report.site_ref || [],
      photo_groups: report.photo_groups || [],
      carSheet: report.carSheet || {}
    };

    res.json({
      success: true,
      images
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  uploadReportImages,
  moveTempFiles,
  cleanupImages,
  getReportImages
};
