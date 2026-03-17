// src/services/dailyReportImageService.js
// Service for handling daily report image operations with Supabase

const DailyReport = require('../models/dailyReportModel');
const { uploadImageToSupabase, moveFileInSupabase, deleteFileFromSupabase } = require('../integrations/supabase/server');

/**
 * Process image uploads for daily reports
 * @param {string} reportId - Report ID (can be temp)
 * @param {string} userId - User ID
 * @param {Array} imageData - Array of image data with files
 * @param {string} imageType - Type of images (hse, site, car, photo, logo)
 * @returns {Promise<Object>} Processed image data
 */
const processImageUploads = async (reportId, userId, imageData, imageType) => {
  try {
    console.log(`DEBUG: Processing ${imageType} image uploads for report ${reportId}`);
    
    const uploadedImages = [];
    const errors = [];
    
    // Process each image
    for (let i = 0; i < imageData.length; i++) {
      const imageItem = imageData[i];
      
      try {
        let result;
        
        if (imageItem.file instanceof File) {
          // New file upload
          const folderId = reportId?.startsWith('temp-') 
            ? `temp-uploads/${userId}` 
            : reportId;
          
          const path = `daily-reports/${folderId}/${imageType}-images/${imageItem.file.name}`;
          
          result = await uploadImageToSupabase(imageItem.file, path);
          
          if (result.success) {
            uploadedImages.push({
              supabaseUrl: result.publicUrl,
              supabasePath: result.path,
              fileName: imageItem.file.name,
              fileSize: imageItem.file.size,
              fileType: imageItem.file.type,
              caption: imageItem.caption || imageItem.file.name,
              isTemp: reportId?.startsWith('temp-')
            });
            console.log(`DEBUG: Successfully uploaded ${imageItem.file.name}`);
          } else {
            errors.push({ file: imageItem.file.name, error: result.error });
            console.error(`DEBUG: Failed to upload ${imageItem.file.name}:`, result.error);
          }
        } else if (imageItem.supabaseUrl) {
          // Existing Supabase image
          uploadedImages.push({
            supabaseUrl: imageItem.supabaseUrl,
            supabasePath: imageItem.supabasePath,
            fileName: imageItem.fileName,
            fileSize: imageItem.fileSize,
            fileType: imageItem.fileType,
            caption: imageItem.caption
          });
        } else if (imageItem.legacyBase64) {
          // Legacy Base64 - keep as is for now
          uploadedImages.push({
            legacyBase64: imageItem.legacyBase64,
            caption: imageItem.caption || 'Legacy image'
          });
        } else {
          errors.push({ file: 'unknown', error: 'Invalid image data format' });
        }
      } catch (error) {
        errors.push({ file: imageItem.file?.name || 'unknown', error: error.message });
        console.error(`DEBUG: Error processing image:`, error);
      }
    }
    
    console.log(`DEBUG: Image processing complete. Success: ${uploadedImages.length}, Errors: ${errors.length}`);
    
    return {
      success: errors.length === 0,
      images: uploadedImages,
      errors,
      hasTempFiles: uploadedImages.some(img => img.isTemp)
    };
    
  } catch (error) {
    console.error('DEBUG: Error in processImageUploads:', error);
    return {
      success: false,
      images: [],
      errors: [{ error: error.message }],
      hasTempFiles: false
    };
  }
};

/**
 * Move temp files to permanent location when report is saved
 * @param {string} tempReportId - Temporary report ID
 * @param {string} finalReportId - Final report ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Move operation result
 */
const moveTempFilesOnSave = async (tempReportId, finalReportId, userId) => {
  try {
    console.log(`DEBUG: Moving temp files from ${tempReportId} to ${finalReportId}`);
    
    if (!tempReportId.startsWith('temp-')) {
      console.log('DEBUG: Not a temp report, no files to move');
      return { success: true, movedFiles: [] };
    }
    
    // Get temp folder path
    const tempPath = `temp-uploads/${userId}`;
    
    // Get final folder path
    const finalPath = finalReportId;
    
    // List files in temp folder
    const { listFiles } = require('../integrations/supabase/server');
    const { success: listSuccess, data: tempFiles } = await listFiles(`daily-reports/${tempPath}`);
    
    if (!listSuccess) {
      return { success: false, error: 'Failed to list temp files', movedFiles: [] };
    }
    
    const movedFiles = [];
    const errors = [];
    
    // Move each file type
    const imageTypes = ['hse-images', 'site-images', 'car-images', 'photo-images', 'logo-images'];
    
    for (const imageType of imageTypes) {
      const { success: typeListSuccess, data: typeFiles } = await listFiles(`daily-reports/${tempPath}/${imageType}`);
      
      if (typeListSuccess && typeFiles.length > 0) {
        for (const file of typeFiles) {
          const oldPath = `${tempPath}/${imageType}/${file.name}`;
          const newPath = `${finalPath}/${imageType}/${file.name}`;
          
          const { success: moveSuccess } = await moveFileInSupabase(oldPath, newPath);
          
          if (moveSuccess) {
            movedFiles.push({
              oldPath,
              newPath,
              fileName: file.name,
              imageType
            });
            console.log(`DEBUG: Moved ${file.name} from ${oldPath} to ${newPath}`);
          } else {
            errors.push({ file: file.name, error: 'Move failed' });
          }
        }
      }
    }
    
    // Update database with new paths
    if (movedFiles.length > 0) {
      await updateReportSupabasePaths(finalReportId, movedFiles);
    }
    
    return {
      success: errors.length === 0,
      movedFiles,
      errors
    };
    
  } catch (error) {
    console.error('DEBUG: Error moving temp files:', error);
    return { success: false, error: error.message, movedFiles: [] };
  }
};

/**
 * Update report Supabase paths after moving files
 * @param {string} reportId - Report ID
 * @param {Array} movedFiles - Array of moved file information
 * @returns {Promise<void>}
 */
const updateReportSupabasePaths = async (reportId, movedFiles) => {
  try {
    console.log(`DEBUG: Updating Supabase paths for report ${reportId}`);
    
    const report = await DailyReport.findById(reportId);
    if (!report) {
      console.error('DEBUG: Report not found for path update');
      return;
    }
    
    let updated = false;
    
    // Update project logo if it was moved
    if (report.projectLogo && report.projectLogo.legacyBase64) {
      const movedLogo = movedFiles.find(f => f.dest && f.dest.includes('logo'));
      if (movedLogo) {
        report.projectLogo = {
          supabaseUrl: movedLogo.uploadData.publicUrl,
          supabasePath: movedLogo.dest,
          fileName: movedLogo.originalFile.name,
          fileSize: movedLogo.originalFile.size,
          fileType: movedLogo.originalFile.type
        };
        updated = true;
      }
    }
    
    // Update image arrays
    const imageArrays = ['hse', 'site_ref', 'photo_groups'];
    
    imageArrays.forEach(arrayName => {
      if (report[arrayName]) {
        report[arrayName].forEach(section => {
          if (section.images) {
            section.images.forEach((image, index) => {
              if (image.legacyBase64) {
                const movedImage = movedFiles.find(f => 
                  f.dest && f.dest.includes(arrayName.replace('_', '-'))
                );
                if (movedImage) {
                  section.images[index] = {
                    supabaseUrl: movedImage.uploadData.publicUrl,
                    supabasePath: movedImage.dest,
                    fileName: movedImage.originalFile.name,
                    fileSize: movedImage.originalFile.size,
                    fileType: movedImage.originalFile.type,
                    caption: image.caption
                  };
                  updated = true;
                }
              }
            });
          }
        });
      }
    });
    
    // Update CAR sheet images
    if (report.carSheet && report.carSheet.photo_groups) {
      report.carSheet.photo_groups.forEach(group => {
        if (group.images) {
          group.images.forEach((image, index) => {
            if (image.legacyBase64) {
              const movedImage = movedFiles.find(f => f.dest && f.dest.includes('car'));
              if (movedImage) {
                group.images[index] = {
                  supabaseUrl: movedImage.uploadData.publicUrl,
                  supabasePath: movedImage.dest,
                  fileName: movedImage.originalFile.name,
                  fileSize: movedImage.originalFile.size,
                  fileType: movedImage.originalFile.type,
                  caption: image.caption
                };
                updated = true;
              }
            }
          });
        }
      });
    }
    
    if (updated) {
      await report.save();
      console.log('DEBUG: Report Supabase paths updated successfully');
    }
    
  } catch (error) {
    console.error('DEBUG: Error updating Supabase paths:', error);
  }
};

/**
 * Delete unused images from Supabase
 * @param {Array} currentImages - Current image metadata
 * @param {Array} newImages - New image metadata
 * @returns {Promise<Object>} Deletion result
 */
const cleanupUnusedImages = async (currentImages, newImages) => {
  try {
    console.log(`DEBUG: Cleaning up unused images. Current: ${currentImages.length}, New: ${newImages.length}`);
    
    // Find images to delete (in current but not in new)
    const imagesToDelete = currentImages.filter(current => 
      !newImages.find(newItem => 
        newItem.supabasePath === current.supabasePath || 
        newItem.legacyBase64 === current.legacyBase64
      )
    );
    
    console.log(`DEBUG: Found ${imagesToDelete.length} images to delete`);
    
    const deletePromises = imagesToDelete
      .filter(img => img.supabasePath)
      .map(img => deleteFileFromSupabase(img.supabasePath));
    
    const results = await Promise.allSettled(deletePromises);
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log(`DEBUG: Image cleanup complete. Success: ${successful}, Failed: ${failed}`);
    
    return {
      success: failed === 0,
      deletedCount: successful,
      failedCount: failed,
      errors: results
        .filter(r => r.status === 'rejected')
        .map(r => r.reason.message)
    };
    
  } catch (error) {
    console.error('DEBUG: Error in cleanupUnusedImages:', error);
    return {
      success: false,
      deletedCount: 0,
      failedCount: 0,
      errors: [error.message]
    };
  }
};

module.exports = {
  processImageUploads,
  moveTempFilesOnSave,
  updateReportSupabasePaths,
  cleanupUnusedImages
};
