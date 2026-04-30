const { pdf } = require('pdf-to-img');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const { uploadImageToSupabase, getPublicUrl, deleteFileFromSupabase } = require('../integrations/supabase/server');
const WeeklyReport = require('../models/WeeklyReport');
const axios = require('axios');

/**
 * Convert PDF to images and upload to Supabase
 * @param {string} pdfUrl - Supabase public URL of the PDF
 * @param {string} reportId - Weekly report ID
 * @param {string} entryId - Master schedule entry ID
 * @param {string} userId - User ID for storage path
 * @returns {Promise<{success: boolean, images?: Array, error?: string}>}
 */
const convertPdfToImages = async (pdfUrl, reportId, entryId, userId) => {
  try {
    console.log(`[PDF Conversion] Starting conversion for entry ${entryId}`);
    console.log(`[PDF Conversion] PDF URL: ${pdfUrl}`);

    // Download PDF from Supabase
    const pdfResponse = await axios.get(pdfUrl, {
      responseType: 'arraybuffer',
      timeout: 60000 // 60 second timeout
    });

    if (!pdfResponse.data || pdfResponse.data.length === 0) {
      throw new Error('Failed to download PDF - empty response');
    }

    const pdfBuffer = Buffer.from(pdfResponse.data);
    console.log(`[PDF Conversion] Downloaded PDF, size: ${pdfBuffer.length} bytes`);

    // Convert PDF to images using pdf-to-img
    const images = [];
    let pageNumber = 1;

    // pdf-to-img returns an async iterator of PNG buffers
    for await (const page of await pdf(pdfBuffer, {
      scale: 2.0 // 2x scale for better quality (144 DPI)
    })) {
      console.log(`[PDF Conversion] Processing page ${pageNumber}`);

      // Convert PNG to JPEG and compress with sharp
      const jpegBuffer = await sharp(page)
        .jpeg({
          quality: 85,
          progressive: true,
          mozjpeg: true
        })
        .toBuffer();

      // Get image dimensions
      const metadata = await sharp(jpegBuffer).metadata();

      // Generate unique filename
      const fileName = `page-${pageNumber}-${uuidv4()}.jpg`;
      const storagePath = `temp-uploads/${userId}/pdf-conversions/${entryId}/${fileName}`;

      // Upload to Supabase
      const uploadResult = await uploadImageToSupabase(
        jpegBuffer,
        storagePath,
        {
          contentType: 'image/jpeg',
          upsert: true
        }
      );

      if (!uploadResult.success) {
        throw new Error(`Failed to upload page ${pageNumber}: ${uploadResult.error}`);
      }

      // Get public URL
      const { publicUrl } = await getPublicUrl(storagePath);

      images.push({
        pageNumber,
        supabaseUrl: publicUrl,
        supabasePath: storagePath,
        width: metadata.width || 0,
        height: metadata.height || 0
      });

      console.log(`[PDF Conversion] Page ${pageNumber} converted and uploaded: ${publicUrl}`);
      pageNumber++;
    }

    if (images.length === 0) {
      throw new Error('No pages were converted from the PDF');
    }

    console.log(`[PDF Conversion] Successfully converted ${images.length} pages`);

    // Update the weekly report with converted images
    await updateMasterScheduleEntry(reportId, entryId, images);

    return {
      success: true,
      images,
      pageCount: images.length
    };

  } catch (error) {
    console.error('[PDF Conversion] Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to convert PDF to images'
    };
  }
};

/**
 * Update master schedule entry with converted images
 * @param {string} reportId - Weekly report ID
 * @param {string} entryId - Master schedule entry ID
 * @param {Array} images - Converted image data
 */
const updateMasterScheduleEntry = async (reportId, entryId, images) => {
  try {
    const report = await WeeklyReport.findById(reportId);

    if (!report) {
      throw new Error('Weekly report not found');
    }

    if (!report.sections || !report.sections.masterSchedule) {
      throw new Error('Master schedule section not found');
    }

    // Find the entry
    const entryIndex = report.sections.masterSchedule.findIndex(
      entry => entry.id === entryId
    );

    if (entryIndex === -1) {
      throw new Error('Master schedule entry not found');
    }

    // Update the entry with converted images
    report.sections.masterSchedule[entryIndex].convertedImages = images;
    report.updatedAt = new Date();

    await report.save();

    console.log(`[PDF Conversion] Updated report ${reportId} entry ${entryId} with ${images.length} images`);

  } catch (error) {
    console.error('[PDF Conversion] Error updating entry:', error);
    throw error;
  }
};

/**
 * Delete converted images from Supabase
 * @param {Array} images - Array of converted image objects
 */
const deleteConvertedImages = async (images) => {
  try {
    if (!images || images.length === 0) return;

    for (const image of images) {
      if (image.supabasePath) {
        await deleteFileFromSupabase(image.supabasePath);
        console.log(`[PDF Conversion] Deleted image: ${image.supabasePath}`);
      }
    }
  } catch (error) {
    console.error('[PDF Conversion] Error deleting images:', error);
  }
};

/**
 * Reconvert PDF (delete old images and create new ones)
 * @param {string} pdfUrl - Supabase public URL of the PDF
 * @param {string} reportId - Weekly report ID
 * @param {string} entryId - Master schedule entry ID
 * @param {string} userId - User ID for storage path
 * @param {Array} existingImages - Existing converted images to delete
 */
const reconvertPdf = async (pdfUrl, reportId, entryId, userId, existingImages) => {
  // Delete old images first
  if (existingImages && existingImages.length > 0) {
    await deleteConvertedImages(existingImages);
  }

  // Convert again
  return await convertPdfToImages(pdfUrl, reportId, entryId, userId);
};

/**
 * Convert PDF to images WITHOUT updating database (for unsaved reports)
 * @param {string} pdfUrl - Supabase public URL of the PDF
 * @param {string} tempId - Temporary ID for storage path
 * @param {string} userId - User ID for storage path
 * @returns {Promise<{success: boolean, images?: Array, error?: string}>}
 */
const convertPdfToImagesStandalone = async (pdfUrl, tempId, userId) => {
  try {
    console.log(`[PDF Conversion Standalone] Starting conversion for tempId ${tempId}`);
    console.log(`[PDF Conversion Standalone] PDF URL: ${pdfUrl}`);

    // Download PDF from Supabase
    const pdfResponse = await axios.get(pdfUrl, {
      responseType: 'arraybuffer',
      timeout: 60000
    });

    if (!pdfResponse.data || pdfResponse.data.length === 0) {
      throw new Error('Failed to download PDF - empty response');
    }

    const pdfBuffer = Buffer.from(pdfResponse.data);
    console.log(`[PDF Conversion Standalone] Downloaded PDF, size: ${pdfBuffer.length} bytes`);

    // Convert PDF to images
    const images = [];
    let pageNumber = 1;

    for await (const page of await pdf(pdfBuffer, { scale: 2.0 })) {
      console.log(`[PDF Conversion Standalone] Processing page ${pageNumber}`);

      // Convert PNG to JPEG
      const jpegBuffer = await sharp(page)
        .jpeg({ quality: 85, progressive: true, mozjpeg: true })
        .toBuffer();

      const metadata = await sharp(jpegBuffer).metadata();

      // Generate unique filename
      const fileName = `page-${pageNumber}-${uuidv4()}.jpg`;
      const storagePath = `temp-uploads/${userId}/pdf-conversions/temp-${tempId}/${fileName}`;

      // Upload to Supabase
      const uploadResult = await uploadImageToSupabase(
        jpegBuffer,
        storagePath,
        { contentType: 'image/jpeg', upsert: true }
      );

      if (!uploadResult.success) {
        throw new Error(`Failed to upload page ${pageNumber}: ${uploadResult.error}`);
      }

      // Get public URL
      const { publicUrl } = await getPublicUrl(storagePath);

      images.push({
        pageNumber,
        supabaseUrl: publicUrl,
        supabasePath: storagePath,
        width: metadata.width || 0,
        height: metadata.height || 0
      });

      console.log(`[PDF Conversion Standalone] Page ${pageNumber} converted: ${publicUrl}`);
      pageNumber++;
    }

    console.log(`[PDF Conversion Standalone] Successfully converted ${images.length} pages`);

    return {
      success: true,
      images,
      pageCount: images.length
    };

  } catch (error) {
    console.error('[PDF Conversion Standalone] Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to convert PDF to images'
    };
  }
};

module.exports = {
  convertPdfToImages,
  convertPdfToImagesStandalone,
  deleteConvertedImages,
  reconvertPdf
};
