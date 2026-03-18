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
          } else {
            errors.push({ file: imageItem.file.name, error: result.error });
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
        } else {
          errors.push({ file: 'unknown', error: 'Invalid image data format - must have supabaseUrl or file' });
        }
      } catch (error) {
        errors.push({ file: imageItem.file?.name || 'unknown', error: error.message });
      }
    }
    
    
    return {
      success: errors.length === 0,
      images: uploadedImages,
      errors,
      hasTempFiles: uploadedImages.some(img => img.isTemp)
    };
    
  } catch (error) {
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
    
    if (!tempReportId.startsWith('temp-')) {
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
    
    const report = await DailyReport.findById(reportId);
    if (!report) {
      return;
    }
    
    let updated = false;
    
    // Update project logo if it was moved
    if (report.projectLogo && report.projectLogo.supabasePath) {
      const movedLogo = movedFiles.find(f => f.newPath && f.newPath.includes('logo'));
      if (movedLogo) {
        const { getPublicUrl } = require('../integrations/supabase/server');
        const { publicUrl } = await getPublicUrl(movedLogo.newPath);
        
        report.projectLogo = {
          supabaseUrl: publicUrl,
          supabasePath: movedLogo.newPath,
          fileName: movedLogo.fileName,
          fileSize: 0, // We don't have size info after move
          fileType: 'image/jpeg'
        };
        updated = true;
      }
    }
    
    // Update image arrays
    const imageArrays = ['hse', 'site_ref', 'photo_groups'];
    
    for (const arrayName of imageArrays) {
      if (report[arrayName]) {
        for (const section of report[arrayName]) {
          if (section.images) {
            for (let index = 0; index < section.images.length; index++) {
              const image = section.images[index];
              const movedImage = movedFiles.find(f => 
                f.newPath && f.newPath.includes(arrayName.replace('_', '-'))
              );
              if (movedImage) {
                const { getPublicUrl } = require('../integrations/supabase/server');
                const { publicUrl } = await getPublicUrl(movedImage.newPath);
                
                section.images[index] = {
                  supabaseUrl: publicUrl,
                  supabasePath: movedImage.newPath,
                  fileName: movedImage.fileName,
                  fileSize: 0, // We don't have size info after move
                  fileType: 'image/jpeg',
                  caption: image.caption
                };
                updated = true;
              }
            }
          }
        }
      }
    }
    
    // Update CAR sheet images
    if (report.carSheet && report.carSheet.photo_groups) {
      for (const group of report.carSheet.photo_groups) {
        if (group.images) {
          for (let index = 0; index < group.images.length; index++) {
            const image = group.images[index];
            if (image.supabasePath) {
              const movedImage = movedFiles.find(f => f.newPath && f.newPath.includes('car'));
              if (movedImage) {
                const { getPublicUrl } = require('../integrations/supabase/server');
                const { publicUrl } = await getPublicUrl(movedImage.newPath);
                
                group.images[index] = {
                  supabaseUrl: publicUrl,
                  supabasePath: movedImage.newPath,
                  fileName: movedImage.fileName,
                  fileSize: 0, // We don't have size info after move
                  fileType: 'image/jpeg',
                  caption: image.caption
                };
                updated = true;
              }
            }
          }
        }
      }
    }
    
    if (updated) {
      await report.save();
    }
    
  } catch (error) {
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
    
    // Find images to delete (in current but not in new)
    const imagesToDelete = currentImages.filter(current => 
      !newImages.find(newItem => 
        newItem.supabasePath === current.supabasePath
      )
    );
    
    
    const deletePromises = imagesToDelete
      .filter(img => img.supabasePath)
      .map(img => deleteFileFromSupabase(img.supabasePath));
    
    const results = await Promise.allSettled(deletePromises);
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    
    return {
      success: failed === 0,
      deletedCount: successful,
      failedCount: failed,
      errors: results
        .filter(r => r.status === 'rejected')
        .map(r => r.reason.message)
    };
    
  } catch (error) {
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
