const dailyReportImageService = require("./dailyReportImageService");
const { uploadImageToSupabase, getPublicUrl, listFilesInSupabase } = require("../integrations/supabase/server");
const DailyReport = require("../models/dailyReportModel.js");
const User = require("../models/userModel.js");
/**
 * Get images from Supabase and store in HSE section
 */
const getImagesFromSupabase = async (userId) => {
  try {
    
    // List all images in the hse-images folder for this user
    const { data, error } = await listFilesInSupabase(`temp-uploads/${userId}/hse-images/`);
    
    if (error) {
      return [];
    }
    
    if (!data || data.length === 0) {
      return [];
    }
    
    
    // Get public URLs for all images
    const hseImages = await Promise.all(
      data.map(async (file) => {
        const filePath = `temp-uploads/${userId}/hse-images/${file.name}`;
        const { publicUrl } = await getPublicUrl(filePath);
        
        return {
          supabaseUrl: publicUrl,
          supabasePath: filePath,
          fileName: file.name,
          fileSize: file.size || 0,
          fileType: 'image/jpeg',
          caption: file.name || 'HSE Image'
        };
      })
    );
    
    return hseImages;
    
  } catch (error) {
    return [];
  }
};

/**
 * Add Supabase images to HSE section
 */
const addSupabaseImagesToHSE = async (reportId, userId) => {
  try {
    
    // Get images from Supabase
    const supabaseImages = await getImagesFromSupabase(userId);
    
    if (supabaseImages.length === 0) {
      return;
    }
    
    // Update the report with Supabase images
    const updatedReport = await DailyReport.findByIdAndUpdate(
      reportId,
      { 
        $push: { 
          'hse': {
            $each: [{
              section_title: 'Supabase Images',
              images: supabaseImages,
              footers: []
            }]
          }
        }
      },
      { new: true }
    );
    
    return updatedReport;
    
  } catch (error) {
    throw error;
  }
};

/**
 * Process images in report data - upload to Supabase and replace with URLs
 */
const processReportImages = async (reportData, userId) => {
  
  // Get userId from parameter or reportData or use a default
  const effectiveUserId = userId || reportData.userId || 'unknown-user';
  
  const transformedData = { ...reportData };
  if (reportData.referenceSections && Array.isArray(reportData.referenceSections)) {
    transformedData.hse = reportData.referenceSections.map(section => ({
      section_title: section.title || "",
      images: section.entries || [],
      footers: []
    }));
    
    // Remove referenceSections to reduce document size - they should be uploaded as files
    if (reportData.referenceSections) {
      delete transformedData.referenceSections;
    }
  }
  
  const imageSections = ['hse', 'site_ref', 'photo_groups', 'referenceSections'];
  const processedData = transformedData;
  
  for (const section of imageSections) {
    
    if (processedData[section] && Array.isArray(processedData[section])) {
      
      const processedSection = await Promise.all(
        processedData[section].map(async (sectionItem, index) => {
          // Handle different structures: 'images' for some sections, 'entries' for referenceSections, 'slots' for some HSE data
          const imageArray = sectionItem.images || sectionItem.entries || sectionItem.slots;
          
          if (imageArray && Array.isArray(imageArray)) {
            
            const processedImages = await Promise.all(
              imageArray.map(async (image) => {
                // Images must be Supabase objects or File objects - no base64 allowed
                if (typeof image === 'object' && image.supabaseUrl) {
                  return image;
                }
                // If image is a File object, upload to Supabase
                else if (image instanceof File || (image.file && image.file instanceof File)) {
                  
                  const fileToUpload = image instanceof File ? image : image.file;
                  const fileName = fileToUpload.name || `image-${Date.now()}.jpg`;
                  const supabasePath = `temp-uploads/${effectiveUserId}/${section}-images/${fileName}`;
                  
                  try {
                    
                    const uploadResult = await uploadImageToSupabase(
                      fileToUpload, 
                      supabasePath
                    );
                    
                    
                    if (!uploadResult.success) {
                      throw new Error(`Supabase upload failed: ${uploadResult.error}`);
                    }
                    
                    const { publicUrl } = await getPublicUrl(supabasePath);
                    
                    
                    return {
                      supabaseUrl: publicUrl,
                      supabasePath: supabasePath,
                      fileName: fileName,
                      fileSize: fileToUpload.size,
                      fileType: fileToUpload.type,
                      caption: image.caption || fileName
                    };
                  } catch (error) {
                    throw error;
                  }
                }
                // If image is an object without Supabase URL but with file data
                else if (typeof image === 'object' && (image.buffer || image.blob)) {
                  
                  const fileName = image.fileName || `image-${Date.now()}.jpg`;
                  const supabasePath = `temp-uploads/${effectiveUserId}/${section}-images/${fileName}`;
                  const imageData = image.buffer || image.blob;
                  
                  try {
                    
                    const uploadResult = await uploadImageToSupabase(imageData, supabasePath);
                    
                    
                    if (!uploadResult.success) {
                      throw new Error(`Object Supabase upload failed: ${uploadResult.error}`);
                    }
                    
                    const { publicUrl } = await getPublicUrl(supabasePath);
                    
                    
                    return {
                      supabaseUrl: publicUrl,
                      supabasePath: supabasePath,
                      fileName: fileName,
                      fileSize: imageData.length || 0,
                      fileType: 'image/jpeg',
                      caption: image.caption || fileName
                    };
                  } catch (error) {
                    throw error;
                  }
                }
                // If image is a string, treat as URL
                else if (typeof image === 'string') {
                  return {
                    supabaseUrl: image,
                    caption: 'Image'
                  };
                }
                else {
                  throw new Error('Invalid image format - base64 not supported');
                }
              })
            );
              
              return {
                ...sectionItem,
                images: processedImages
              };
            } else {
              return sectionItem;
            }
        })
      );
      
      processedData[section] = processedSection;
    }
  }
  
  // Handle carSheet images
  if (reportData.carSheet && reportData.carSheet.photo_groups) {
    
    const processedCarSheet = { ...reportData.carSheet };
    processedCarSheet.photo_groups = await Promise.all(
      reportData.carSheet.photo_groups.map(async (photoGroup) => {
        if (photoGroup.images && Array.isArray(photoGroup.images)) {
          const processedImages = await Promise.all(
            photoGroup.images.map(async (image) => {
              // Images must be File objects or Supabase objects - no base64 allowed
              if (typeof image === 'object' && image.supabaseUrl) {
                return image;
              }
              else if (image instanceof File || (image.file && image.file instanceof File)) {
                
                const fileToUpload = image instanceof File ? image : image.file;
                const fileName = fileToUpload.name || `car-image-${Date.now()}.jpg`;
                const supabasePath = `temp-uploads/${effectiveUserId}/car-images/${fileName}`;
                
                try {
                  
                  const uploadResult = await uploadImageToSupabase(
                    fileToUpload, 
                    supabasePath
                  );
                  
                  
                  if (!uploadResult.success) {
                    throw new Error(`CarSheet Supabase upload failed: ${uploadResult.error}`);
                  }
                  
                  const { publicUrl } = await getPublicUrl(supabasePath);
                  
                  
                  return {
                    supabaseUrl: publicUrl,
                    supabasePath: supabasePath,
                    fileName: fileName,
                    fileSize: fileToUpload.size,
                    fileType: fileToUpload.type,
                    caption: image.caption || fileName
                  };
                } catch (error) {
                  throw error;
                }
              }
              else if (typeof image === 'string') {
                return {
                  supabaseUrl: image, 
                  caption: 'Car image'
                };
              }
              else {
                throw new Error('Invalid carSheet image format - base64 not supported');
              }
              })
          );
          
          return {
            ...photoGroup,
            images: processedImages
          };
        } else {
          return photoGroup;
        }
      })
    );
    
    processedData.carSheet = processedCarSheet;
  }
  
  // Handle projectLogo - must be File object or Supabase object
  if (reportData.projectLogo) {
    
    if (typeof reportData.projectLogo === 'object' && reportData.projectLogo.supabaseUrl) {
      // Keep as-is
    }
    else if (reportData.projectLogo instanceof File || (reportData.projectLogo.file && reportData.projectLogo.file instanceof File)) {
      
      const fileToUpload = reportData.projectLogo instanceof File ? reportData.projectLogo : reportData.projectLogo.file;
      const fileName = fileToUpload.name || `project-logo-${Date.now()}.jpg`;
      const supabasePath = `temp-uploads/${effectiveUserId}/logos/${fileName}`;
      
      try {
        
        const uploadResult = await uploadImageToSupabase(
          fileToUpload, 
          supabasePath
        );
        
        
        if (!uploadResult.success) {
          throw new Error(`ProjectLogo Supabase upload failed: ${uploadResult.error}`);
        }
        
        const { publicUrl } = await getPublicUrl(supabasePath);
        
        
        processedData.projectLogo = {
          supabaseUrl: publicUrl,
          supabasePath: supabasePath,
          fileName: fileName,
          fileSize: fileToUpload.size,
          fileType: fileToUpload.type
        };
      } catch (error) {
        console.error("ERROR: Failed to upload projectLogo:", error);
        throw error;
      }
    }
    else if (typeof reportData.projectLogo === 'string') {
      // Keep as URL string
    }
    else {
      throw new Error('Invalid projectLogo format - base64 not supported');
    }
  }
  
    
  return processedData;
};

/**
 * Merge duplicate descriptions in resource arrays to prevent conflicts
 */
const mergeDuplicateDescriptions = (items) => {
  if (!Array.isArray(items)) return [];
  
  const merged = {};
  items.forEach(item => {
    if (item && item.description) {
      const key = item.description.trim();
      if (!merged[key]) {
        merged[key] = { ...item, today: 0 };
      }
      // Sum up the 'today' values for duplicate descriptions
      merged[key].today = (Number(merged[key].today) || 0) + (Number(item.today) || 0);
    }
  });
  
  return Object.values(merged);
};

/**
 * Recalculate rolling totals for future reports when a past report is edited
 */
const recalculateFutureReports = async (userId, projectName, futureReports, session) => {
  for (let i = 0; i < futureReports.length; i++) {
    const currentReport = futureReports[i];

    // Get the previous report (either the one before this in the list or the last before the edited date)
    const previousReport =
      i > 0
        ? futureReports[i - 1]
        : await DailyReport.findOne({
            userId,
            projectName,  // ← Also filter by project for consistency
            reportDate: { $lt: currentReport.reportDate },
          })
            .sort({ reportDate: -1 })
            .session(session);

    // Helper function to recalculate rolling totals
    const recalculateRollingTotals = (items, previousItems = []) => {
      return items.map((item) => {
        const prevItem = previousItems.find(
          (p) => p.description === item.description
        );
        const prevAccum = prevItem?.accumulated || 0;
        const today = Number(item.today) || 0;
        return {
          ...item,
          prev: prevAccum,
          accumulated: prevAccum + today,
        };
      });
    };

    // Recalculate all arrays
    currentReport.managementTeam = recalculateRollingTotals(
      currentReport.managementTeam || [],
      previousReport?.managementTeam || []
    );

    currentReport.workingTeamInterior = recalculateRollingTotals(
      currentReport.workingTeamInterior || [],
      previousReport?.workingTeamInterior || []
    );

    currentReport.workingTeamMEP = recalculateRollingTotals(
      currentReport.workingTeamMEP || [],
      previousReport?.workingTeamMEP || []
    );

    // Keep backward compatibility for old workingTeam
    currentReport.workingTeam = recalculateRollingTotals(
      currentReport.workingTeam || [],
      previousReport?.workingTeam || []
    );

    currentReport.materials = recalculateRollingTotals(
      currentReport.materials || [],
      previousReport?.materials || []
    );

    currentReport.machinery = recalculateRollingTotals(
      currentReport.machinery || [],
      previousReport?.machinery || []
    );

    await currentReport.save({ session });
  }
};

/**
 * Get all reports for a specific user
 */
const getAllReports = async (userId) => {
  return await DailyReport.find({ userId }).sort({ reportDate: -1 });
};

/**
 * Get a specific report by ID and userId
 */
const getReportById = async (userId, reportId, companyId) => {
  // First try to find user's own report
  let report = await DailyReport.findOne({ _id: reportId, userId });
  
  // If not found and user has companyId, try company-wide access
  if (!report && companyId) {
    report = await DailyReport.findOne({ _id: reportId, companyId });
  }
  
  return report;
};

/**
 * Get a single report by userId + date
 */
const getReportByDate = async (userId, reportDate, projectName = null) => {
  // Create date range for the entire day
  const inputDate = new Date(reportDate);

  const startOfDay = new Date(
    Date.UTC(
      inputDate.getUTCFullYear(),
      inputDate.getUTCMonth(),
      inputDate.getUTCDate(),
      0,
      0,
      0,
      0
    )
  );

  const endOfDay = new Date(
    Date.UTC(
      inputDate.getUTCFullYear(),
      inputDate.getUTCMonth(),
      inputDate.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );

  console.log("Searching for report with:", {
    userId,
    projectName,
    startOfDay: startOfDay.toISOString(),
    endOfDay: endOfDay.toISOString(),
  });

  const query = {
    userId,
    reportDate: {
      $gte: startOfDay,
      $lte: endOfDay,
    },
  };

  if (projectName) {
    query.projectName = projectName;
  }

  const report = await DailyReport.findOne(query);

  console.log("Found report:", report ? "YES" : "NO");
  return report;
};

/**
 * Get a report by date only (no projectName required) - DEPRECATED
 * This function is insecure and should not be used
 */
const getReportByDateOnly = async (reportDate) => {
  throw new Error("getReportByDateOnly is deprecated for security reasons. Use getReportByDate with userId instead.");
};

/**
 * Upsert daily report with proper update/insert logic
 * If report exists for same project and date: update it and set lastUpdated
 * If report doesn't exist: insert as new record
 */
const upsertDailyReport = async (userId, reportData, companyId) => {
  // 🚀 NEW: Process images through Supabase first!
  let processedReportData;
  try {
    processedReportData = await processReportImages(reportData, userId);
    
    // Check if any invalid data exists in processed data
    const hasInvalidData = JSON.stringify(processedReportData).includes('data:image/');
    const hasSupabaseUrl = JSON.stringify(processedReportData).includes('supabaseUrl');
    
    if (hasInvalidData) {
      throw new Error('Base64 data detected - base64 is not supported');
    }
  } catch (error) {
    // If image processing fails, use original data
    processedReportData = reportData;
  }

  // Get user's full name for createdBy field
  const user = await User.findById(userId);
  const userFullName = user ? `${user.firstName} ${user.lastName}` : "";

  const session = await DailyReport.startSession();
  session.startTransaction();

  try {
    const { projectName, reportDate } = reportData;
    const inputDate = new Date(reportDate);

    // Set search window strictly in UTC
    const startOfDay = new Date(inputDate);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(inputDate);
    endOfDay.setUTCHours(23, 59, 59, 999);


    // Find existing report - check by reportId first, then projectId+date, then projectName+date
    let report = null;
    
    // 1. If reportId provided, find by reportId (draft being saved)
    if (reportData.reportId) {
      report = await DailyReport.findById(reportData.reportId).session(session);
    }
    
    // 2. If not found and projectId provided, find by projectId + date (handles renamed projects)
    if (!report && reportData.projectId) {
      const projectIdQuery = {
        userId,
        projectId: reportData.projectId,
        reportDate: { $gte: startOfDay, $lte: endOfDay },
      };
      
      // Add location to query if provided
      if (reportData.location) {
        projectIdQuery.location = reportData.location;
      }
      
      // Add folderId to query if provided
      if (reportData.folderId) {
        projectIdQuery.folderId = reportData.folderId;
      } else {
        projectIdQuery.$or = [{ folderId: { $exists: false } }, { folderId: null }];
      }
      
      report = await DailyReport.findOne(projectIdQuery).session(session);
    }
    
    // 3. If still not found, fallback to projectName + date (backward compatibility)
    if (!report) {
      const query = {
        userId,
        projectName,
        reportDate: { $gte: startOfDay, $lte: endOfDay },
      };
      
      // Add location to query if provided
      if (reportData.location) {
        query.location = reportData.location;
      }
      
      // Add folderId to query if provided (to separate reports in different folders)
      if (reportData.folderId) {
        query.folderId = reportData.folderId;
      } else {
        // If no folderId specified, match reports without a folder (project root level)
        query.$or = [{ folderId: { $exists: false } }, { folderId: null }];
      }
      
      report = await DailyReport.findOne(query).session(session);
    }


    // 🔥 FIX #1: Get the previous report with projectName, location, AND folder filter
    const previousReportQuery = {
      userId,
      projectName,  // ← CRITICAL FIX: Must match same project!
      reportDate: { $lt: startOfDay },
    };
    
    // Add location to previous report query if current location is provided
    if (reportData.location) {
      previousReportQuery.location = reportData.location;
    }
    
    // Add folderId to previous report query if provided
    if (reportData.folderId) {
      previousReportQuery.folderId = reportData.folderId;
    }
    
    const previousReport = await DailyReport.findOne(previousReportQuery)
      .sort({ reportDate: -1 })
      .session(session);


    // 🔥 FIX #3: Enhanced rolling totals with validation
    const calculateRollingTotals = (newItems, previousItems = []) => {
      // First, merge any duplicate descriptions in current day's data
      const uniqueNewItems = mergeDuplicateDescriptions(newItems);
      
      return uniqueNewItems.map((item) => {
        const prevItem = previousItems.find(
          (p) => p.description?.trim() === item.description?.trim()
        );
        
        const userPrev = Number(item.prev) || 0;
        const today = Number(item.today) || 0;
        const accumulated = userPrev + today;  // ← USER'S prev + today
        
        // Validation logging
        
        return {
          ...item,
          prev: Number(item.prev) || userPrev,  // ← RESPECT USER INPUT
          today: today, // Ensure it's a number
          accumulated: accumulated,
        };
      });
    };

    // Helper function to handle text field updates
    const updateTextField = (existingValue, newValue, strategy = 'replace') => {
      if (strategy === 'append' && existingValue && newValue) {
        // Avoid duplicate content when appending
        if (existingValue.includes(newValue)) {
          return existingValue;
        }
        return existingValue + '\n' + newValue;
      }
      return newValue !== undefined ? newValue : existingValue;
    };

    // Helper function to handle numeric field updates
    const updateNumericField = (existingValue, newValue) => {
      if (newValue !== undefined && newValue !== null && newValue !== '') {
        const parsed = Number(newValue);
        return isNaN(parsed) ? existingValue : parsed;
      }
      return existingValue;
    };

    // Calculate rolling totals for all resource arrays
    const managementTeam = calculateRollingTotals(
      reportData.managementTeam || [],
      previousReport?.managementTeam || []
    );

    const workingTeamInterior = calculateRollingTotals(
      reportData.workingTeamInterior || [],
      previousReport?.workingTeamInterior || []
    );

    const workingTeamMEP = calculateRollingTotals(
      reportData.workingTeamMEP || [],
      previousReport?.workingTeamMEP || []
    );

    // Keep backward compatibility for old workingTeam
    const workingTeam = calculateRollingTotals(
      reportData.workingTeam || [],
      previousReport?.workingTeam || []
    );

    const materials = calculateRollingTotals(
      reportData.materials || [],
      previousReport?.materials || []
    );

    // NEW: Handle activities data (no rolling totals needed for activities)
    const activities = reportData.activities || {
      weeklyActivities: [],
      nextWeekPlan: []
    };
    

    const machinery = calculateRollingTotals(
      reportData.machinery || [],
      previousReport?.machinery || []
    );

    if (report) {
      // Update existing report
      
      // Update projectId if provided (allows migrating old reports to new project linking)
      if (reportData.projectId && !report.projectId) {
        report.projectId = reportData.projectId;
      }
      
      // Update text fields with strategy using processed data
      report.location = updateTextField(report.location, processedReportData.location, 'replace');
      report.description = updateTextField(report.description, processedReportData.description, 'replace');
      report.workPlanNextDay = updateTextField(report.workPlanNextDay, processedReportData.workPlanNextDay, 'replace');
      report.activityToday = updateTextField(report.activityToday, processedReportData.activityToday, 'replace');
      report.workPlanNextWeek = updateTextField(report.workPlanNextWeek, processedReportData.workPlanNextWeek, 'replace');
      report.challenges = updateTextField(report.challenges, processedReportData.challenges, 'replace');
      report.lessonsLearned = updateTextField(report.lessonsLearned, processedReportData.lessonsLearned, 'replace');
      report.nextDayPlan = updateTextField(report.nextDayPlan, processedReportData.nextDayPlan, 'replace');
      
      // Update resource arrays with rolling totals
      report.managementTeam = managementTeam;
      report.workingTeamInterior = workingTeamInterior;
      report.workingTeamMEP = workingTeamMEP;
      report.workingTeam = workingTeam; // Keep backward compatibility
      report.materials = materials;
      report.machinery = machinery;
      report.activities = processedReportData.activities; // Use processed activities
      report.hse = processedReportData.hse; // Use processed HSE
      report.referenceSections = processedReportData.referenceSections; // Use processed referenceSection
      report.site_ref = processedReportData.site_ref; // Use processed site_ref
      report.photo_groups = processedReportData.photo_groups; // Use processed photo_groups
      report.carSheet = processedReportData.carSheet; // Use processed carSheet
      report.projectLogo = processedReportData.projectLogo; // Use processed projectLogo
      
      await report.save({ session });
    } else {
      // Create new report

      const newReportData = {
        userId,
        companyId,
        createdBy: userFullName,
        // Add projectId if provided (for reliable project linking)
        ...(reportData.projectId && { projectId: reportData.projectId }),
        ...processedReportData, // 🚀 Use processed data with Supabase URLs
        managementTeam,
        workingTeamInterior,
        workingTeamMEP,
        workingTeam, // Keep backward compatibility
        materials,
        machinery,
        activities,
        status: "draft",
        lastUpdated: new Date(),
        // Add folder info if provided
        ...(reportData.folderId && { folderId: reportData.folderId }),
        ...(reportData.folderName && { folderName: reportData.folderName }),
      };
      
      report = new DailyReport(newReportData);
      
      try {
        const Project = require('../models/projectModel');
        await Project.findOneAndUpdate(
          { 
            name: reportData.projectName, 
            isActive: true 
          },
          { 
            $inc: { reportCount: 1 },
            $set: { lastReportDate: inputDate }
          },
          { 
            new: true,
            upsert: false
          }
        );
      } catch (projectError) {
        // Don't fail report creation if project update fails
      }

      const result = await report.save({ session });
      // console.log("DEBUG: New report saved successfully with _id:", result._id);
      
      // Verify save immediately (Comment out for Deployment)
      // const verification = await DailyReport.findOne({ _id: result._id }).session(session);
      // console.log("DEBUG: Verification - found in DB:", verification ? "YES" : "NO");
      
      // if (!verification) {
      //   throw new Error("Save verification failed - document not found after save");
      // }
    }

    // Check if there are future reports that need recalculation
    const futureReportsQuery = {
      userId,
      projectName,  // ← Also filter future reports by project
      reportDate: { $gt: endOfDay },
    };
    
    // Add location to future reports query if current location is provided
    if (reportData.location) {
      futureReportsQuery.location = reportData.location;
    }
    
    // Add folderId to future reports query if provided
    if (reportData.folderId) {
      futureReportsQuery.folderId = reportData.folderId;
    }
    
    const futureReports = await DailyReport.find(futureReportsQuery)
      .sort({ reportDate: 1 })
      .session(session);

    if (futureReports.length > 0) {
      await recalculateFutureReports(userId, projectName, futureReports, session);
    }

    await session.commitTransaction();
    return report;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Submit a report
 * Marks the report as 'submitted' and validates required fields
 */
const submitDailyReport = async (userId, projectName, reportDate) => {
  try {
    // First, find the existing report to validate it
    const existingReport = await DailyReport.findOne({
      userId,
      projectName,
      reportDate,
    });

    if (!existingReport) {
      throw new Error("Report not found. Please create a report first.");
    }

    // Validate required fields before submitting
    if (!existingReport.activityToday || existingReport.activityToday.trim() === "") {
      throw new Error("Activity Today is required before submitting the report");
    }

    // Update the report with submitted status and timestamp
    existingReport.status = "submitted";
    existingReport.submittedAt = new Date();
    
    await existingReport.save();
    
    return existingReport;
  } catch (error) {
    throw error;
  }
};

/**
 * Create a new report with default/empty data
 * Always creates a new report, allows multiple reports per date/project
 */
const createNewReport = async (userId, projectName, reportDate, companyId) => {
  try {

    // Get user's full name for createdBy field
    const user = await User.findById(userId);
    const userFullName = user ? `${user.firstName} ${user.lastName}` : "";

  


    // No longer checking for existing reports - allow multiple reports per date/project
    // Create new report with default values
    let processedReportData;
    try {
      processedReportData = await processReportImages(reportData, userId);
    } catch (error) {
      processedReportData = reportData; // Use original if processing fails
    }
    
    const report = new DailyReport({
      userId,
      companyId,
      createdBy: userFullName, // Auto-populate from authenticated user
      projectName: projectName ,
      projectId: reportData.projectId || null, // Add projectId support
      ...processedReportData, // Use processed data with Supabase URLs
      reportDate,
      status: "draft",
      // Weather fields
      weatherAM: "",
      weatherPM: "",
      tempAM: "",
      tempPM: "",
      currentPeriod: "AM",
      // Activity fields (with empty defaults to satisfy validation)
      activityToday: "",
      workPlanNextDay: "",
      // NEW: Add activities field with default structure
      activities: {
        weeklyActivities: [],
        nextWeekPlan: []
      },
      // Resource arrays (empty by default)
      managementTeam: [],
      workingTeamInterior: [],
      workingTeamMEP: [],
      workingTeam: [], // Keep backward compatibility
      materials: [],
      machinery: [],
      // Optional fields for backward compatibility
      weather: "",
      weatherPeriod: "AM",
      temperature: "",
    });

    await report.save();
    
    // 🚀 NEW: Update project statistics
    try {
      const Project = require('../models/projectModel');
      await Project.findOneAndUpdate(
        { 
          name: projectName, 
          isActive: true 
        },
        { 
          $inc: { reportCount: 1 },  // ← Increment count
          $set: { lastReportDate: reportDate }  // ← Update last report date
        },
        { 
          new: true,  // Return updated document
          upsert: false  // Don't create if project doesn't exist
        }
      );
    } catch (projectError) {
      console.error("DEBUG BACKEND SERVICE: Failed to update project stats:", projectError);
      // Don't fail the report creation if project update fails
    }
    
    return report;
  } catch (error) {
    throw error;
  }
};

/**
 * Auto-save report (partial update) - optimized for frequent saves
 * Only updates changed fields, maintains rolling totals
 */
const autoSaveReport = async (userId, reportId, partialData) => {
  try {
    
    const session = await DailyReport.startSession();
    session.startTransaction();

    try {
      // Find existing report
      const report = await DailyReport.findOne({ _id: reportId, userId }).session(session);
      
      if (!report) {
        throw new Error("Report not found for auto-save");
      }

      // Only update fields that are provided in partialData
      const updates = {};
      Object.keys(partialData).forEach(key => {
        if (partialData[key] !== undefined) {
          updates[key] = partialData[key];
        }
      });

      // Update timestamp and status if needed
      updates.updatedAt = new Date();
      if (report.status === 'submitted' && partialData.status !== 'submitted') {
        updates.status = 'draft'; // Revert to draft if edited after submitting
      }

      // Apply updates using report.set() to ensure Mongoose change tracking
      report.set(updates);

      await report.save({ session });
      await session.commitTransaction();
      
      console.log("DEBUG BACKEND SERVICE: Auto-save completed:", report._id);
      return report;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error("DEBUG BACKEND SERVICE: Auto-save error:", error);
    throw error;
  }
};

/**
 * Get recent reports for dashboard, sorted by updatedAt
 */
const getRecentReports = async (userId, limit = 20, statusFilter = null) => {
  try {
    const query = { userId };
    
    if (statusFilter) {
      query.status = statusFilter;
    }

    const reports = await DailyReport.find(query)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .select('projectId projectName reportDate status updatedAt createdAt submittedAt');

    return reports;
  } catch (error) {
    console.error("DEBUG BACKEND SERVICE: Error fetching recent reports:", error);
    throw error;
  }
};

/**
 * Create blank draft report immediately (Google Docs style)
 */
const createBlankReport = async (userId, projectName = null) => {
  try {

    // Get user's full name for createdBy field
    const user = await User.findById(userId);
    const userFullName = user ? `${user.firstName} ${user.lastName}` : "";

    // Process images if any (though blank report shouldn't have images)
    let processedReportData = {};
    try {
      processedReportData = await processReportImages({ userId, projectName, reportDate: new Date() }, userId);
    } catch (error) {
      // For blank report, use minimal data if processing fails
      processedReportData = { userId, projectName, reportDate: new Date() };
    }

    const report = new DailyReport({
      userId,
      createdBy: userFullName, // ← ADD THIS: Auto-populate from authenticated user
      projectName: projectName || "Untitled Report",
      ...processedReportData, // Use processed data with Supabase URLs
      reportDate: new Date(),
      status: "draft",
      // Minimal default data
      weatherAM: "",
      weatherPM: "",
      tempAM: "",
      tempPM: "",
      currentPeriod: "AM",
      activityToday: "",
      workPlanNextDay: "",
      managementTeam: [],
      workingTeamInterior: [],
      workingTeamMEP: [],
      workingTeam: [], // Keep backward compatibility
      materials: [],
      machinery: [],
    });

    await report.save();
    
    console.log("DEBUG BACKEND SERVICE: Blank report created:", report._id);
    return report;
  } catch (error) {
    console.error("DEBUG BACKEND SERVICE: Error creating blank report:", error);
    throw error;
  }
};

const deleteReport = async (userId, reportId) => {
  try {
    console.log("DEBUG BACKEND SERVICE: Deleting report:", { userId, reportId });
    
    // First get the report to get project name before deletion
    const report = await DailyReport.findOne({
      _id: reportId,
      userId: userId, // Ensure user can only delete their own reports
    });
    
    if (!report) {
      console.log("DEBUG BACKEND SERVICE: Report not found for deletion");
      return null;
    }
    
    // Log folder status to verify reports without folders delete correctly
    console.log("DEBUG BACKEND SERVICE: Report found:", { 
      reportId: report._id, 
      projectName: report.projectName,
      folderId: report.folderId || null,
      folderName: report.folderName || null,
      hasFolder: !!report.folderId 
    });
    
    // Delete the report
    const result = await DailyReport.findOneAndDelete({
      _id: reportId,
      userId: userId,
    });
    
    // 🚀 NEW: Update project statistics
    try {
      const Project = require('../models/projectModel');
      
      // Get remaining report count for this project
      const remainingReports = await DailyReport.countDocuments({
        projectName: report.projectName  // ← Count ALL reports in project
      });
      
      await Project.findOneAndUpdate(
        { 
          name: report.projectName, 
          isActive: true 
        },
        { 
          $set: { 
            reportCount: Math.max(0, remainingReports),  // ← Update count
            lastReportDate: remainingReports > 0 ? report.reportDate : null  // ← Update or clear date
          }
        },
        { new: true }
      );
      console.log("DEBUG BACKEND SERVICE: Project stats updated after deletion for:", report.projectName);
    } catch (projectError) {
      console.error("DEBUG BACKEND SERVICE: Failed to update project stats after deletion:", projectError);
    }
    
    console.log("DEBUG BACKEND SERVICE: Report deleted successfully");
    return result;
  } catch (error) {
    console.error("DEBUG BACKEND SERVICE: Error deleting report:", error);
    throw error;
  }
};

const getCompanyReports = async (companyId, page = 1, limit = 20, search = "", projectFilter = "", projectIdFilter = "") => {
  try {
    const skip = (page - 1) * limit;
    
    // Build search query
    let searchQuery = search ? {
      $and: [
        { companyId },
        { status: "submitted" },
        {
          $or: [
            { projectName: { $regex: search, $options: "i" } },
            { activityToday: { $regex: search, $options: "i" } },
            { "userId.firstName": { $regex: search, $options: "i" } },
            { "userId.lastName": { $regex: search, $options: "i" } }
          ]
        }
      ]
    } : { 
      companyId,
      status: "submitted"
    };

    // ADD PROJECT FILTER - Prioritize projectId if available, fallback to projectName
    if (projectIdFilter) {
      // Use projectId for more reliable lookup (works even if project name changed)
      searchQuery = {
        $and: [
          searchQuery,
          { projectId: projectIdFilter }
        ]
      };
    } else if (projectFilter) {
      // Fallback to projectName for backward compatibility
      searchQuery = {
        $and: [
          searchQuery,
          { projectName: projectFilter }
        ]
      };
    }
    const [reports, total] = await Promise.all([
      DailyReport.find(searchQuery)
        .sort({ reportDate: -1, updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'firstName lastName email'),
      DailyReport.countDocuments(searchQuery)
    ]);
    
    return {
      success: true,
      data: reports,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    };
  } catch (error) {
    console.error("Get company reports error:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

const getReportsByLocation = async (location = null, projectName = null, projectId = null) => {
  try {
    const query = { status: "submitted" };
    
    // Prioritize projectId if available, fallback to projectName
    if (projectId) {
      query.projectId = projectId;
    } else if (projectName) {
      query.projectName = projectName;
    }
    
    if (location) {
      query.location = location;
    }
    
    const reports = await DailyReport.find(query)
      .sort({ reportDate: -1, updatedAt: -1 });
    
    return reports;
  } catch (error) {
    console.error("Get reports by location error:", error);
    throw error;
  }
};

module.exports = {
  getAllReports,
  getReportById,
  getReportByDate,
  upsertDailyReport,
  submitDailyReport,
  createNewReport,
  deleteReport,
  autoSaveReport,
  getRecentReports,
  createBlankReport,
  getCompanyReports,
  getReportsByLocation,
  getImagesFromSupabase,
  addSupabaseImagesToHSE,
  processReportImages,
};
