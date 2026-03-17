const dailyReportImageService = require("./dailyReportImageService");
const { uploadImageToSupabase, getPublicUrl, listFilesInSupabase } = require("../integrations/supabase/server");
const DailyReport = require("../models/dailyReportModel.js");
const User = require("../models/userModel.js");
/**
 * Get images from Supabase and store in HSE section
 */
const getImagesFromSupabase = async (userId) => {
  try {
    console.log("DEBUG: Getting images from Supabase for HSE");
    
    // List all images in the hse-images folder for this user
    const { data, error } = await listFilesInSupabase(`temp-uploads/${userId}/hse-images/`);
    
    if (error) {
      console.error("ERROR: Failed to list Supabase files:", error);
      return [];
    }
    
    if (!data || data.length === 0) {
      console.log("DEBUG: No images found in Supabase for this user");
      return [];
    }
    
    console.log(`DEBUG: Found ${data.length} images in Supabase`);
    
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
    
    console.log(`DEBUG: Processed ${hseImages.length} images from Supabase`);
    return hseImages;
    
  } catch (error) {
    console.error("ERROR: Failed to get images from Supabase:", error);
    return [];
  }
};

/**
 * Add Supabase images to HSE section
 */
const addSupabaseImagesToHSE = async (reportId, userId) => {
  try {
    console.log("DEBUG: Adding Supabase images to HSE section");
    
    // Get images from Supabase
    const supabaseImages = await getImagesFromSupabase(userId);
    
    if (supabaseImages.length === 0) {
      console.log("DEBUG: No images to add to HSE");
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
    
    console.log(`DEBUG: Added ${supabaseImages.length} images to HSE section`);
    return updatedReport;
    
  } catch (error) {
    console.error("ERROR: Failed to add Supabase images to HSE:", error);
    throw error;
  }
};

/**
 * Process images in report data - upload to Supabase and replace with URLs
 */
const processReportImages = async (reportData, userId) => {
  console.log("DEBUG: Processing images for Supabase upload");
  
  // Transform referenceSections to hse format FIRST for consistent processing
  const transformedData = { ...reportData };
  if (reportData.referenceSections && Array.isArray(reportData.referenceSections)) {
    console.log("DEBUG: Transforming referenceSections to hse format BEFORE processing");
    transformedData.hse = reportData.referenceSections.map(section => ({
      section_title: section.title || "",
      images: section.entries || [],
      footers: []
    }));
    console.log("DEBUG: Transformed hse data:", transformedData.hse);
  }
  
  const imageSections = ['hse', 'site_ref', 'photo_groups'];
  const processedData = transformedData;
  
  for (const section of imageSections) {
    console.log(`DEBUG: Checking section ${section}:`, {
      exists: !!processedData[section],
      isArray: Array.isArray(processedData[section]),
      type: typeof processedData[section],
      data: processedData[section] ? (Array.isArray(processedData[section]) ? `Array with ${processedData[section].length} items` : 'Not an array') : 'Not defined'
    });
    
    if (processedData[section] && Array.isArray(processedData[section])) {
      console.log(`DEBUG: Processing ${section} images:`, processedData[section].length);
      
      const processedSection = await Promise.all(
        processedData[section].map(async (sectionItem, index) => {
          // Handle different structures: 'images' for some sections, 'entries' for referenceSections, 'slots' for some HSE data
          const imageArray = sectionItem.images || sectionItem.entries || sectionItem.slots;
          
          if (imageArray && Array.isArray(imageArray)) {
            console.log(`DEBUG: Found ${imageArray.length} images in ${section}[${index}]`);
            
            const processedImages = await Promise.all(
              imageArray.map(async (image) => {
                // If image is a Base64 string, upload to Supabase
                if (typeof image === 'string' && image.startsWith('data:image/')) {
                  console.log(`DEBUG: Uploading Base64 image to Supabase for ${section}[${index}]`);
                   
                  try {
                    // Convert Base64 to buffer for Supabase upload
                    const base64Data = image.split(',')[1]; // Remove data:image/jpeg;base64, part
                    const buffer = Buffer.from(base64Data, 'base64');
                    const fileName = `image-${Date.now()}.jpg`;
                    const supabasePath = `temp-uploads/${userId}/${section}-images/${fileName}`;
                    
                    // Upload to Supabase
                    const { data, error } = await uploadImageToSupabase(
                      buffer, 
                      supabasePath
                    );
                    
                    if (error) {
                      console.error(`ERROR: Failed to upload image to Supabase:`, error);
                      return { 
                        legacyBase64: image, // Keep original as fallback
                        caption: image.caption || 'Image'
                      };
                    }
                    
                    // Get public URL
                    const { publicUrl } = await getPublicUrl(supabasePath);
                    
                    console.log(`DEBUG: Successfully uploaded to Supabase: ${publicUrl}`);
                    
                    return {
                      supabaseUrl: publicUrl,
                      supabasePath: supabasePath,
                      fileName: fileName,
                      fileSize: buffer.length,
                      fileType: 'image/jpeg',
                      caption: image.caption || 'Image'
                    };
                  } catch (error) {
                    console.error(`ERROR: Failed to upload image to Supabase:`, error);
                    return { 
                      legacyBase64: image, // Keep original as fallback
                      caption: image.caption || 'Image'
                    };
                  }
                }
                // If image is an object without Supabase URL, upload directly
                else if (typeof image === 'object' && !image.supabaseUrl) {
                  console.log(`DEBUG: Processing object image for ${section}[${index}]:`, typeof image);
                  
                  // Create a file-like object from the image data
                  const fileName = image.fileName || `image-${Date.now()}.jpg`;
                  const supabasePath = `temp-uploads/${userId}/${section}-images/${fileName}`;
                  
                  // Handle different image object structures
                  let imageData;
                  if (image.image && typeof image.image === 'string' && image.image.startsWith('data:image/')) {
                    // Base64 string in object
                    console.log(`DEBUG: Found Base64 in object image, converting to buffer`);
                    const base64Data = image.image.split(',')[1];
                    imageData = Buffer.from(base64Data, 'base64');
                  } else if (image.buffer) {
                    // Buffer data in object
                    console.log(`DEBUG: Found buffer in object image`);
                    imageData = image.buffer;
                  } else if (image.blob) {
                    // Blob data in object
                    console.log(`DEBUG: Found blob in object image`);
                    imageData = image.blob;
                  } else {
                    console.log(`DEBUG: No image data found in object, using placeholder`);
                    // Create a placeholder buffer
                    imageData = Buffer.from('placeholder', 'utf8');
                  }
                  
                  try {
                    const { data, error } = await uploadImageToSupabase(imageData, supabasePath);
                    
                    if (error) {
                      console.error(`ERROR: Failed to upload object image to Supabase:`, error);
                      return {
                        ...image,
                        legacyBase64: image.image || image.buffer || image.blob
                      };
                    }
                    
                    const { publicUrl } = await getPublicUrl(supabasePath);
                    
                    console.log(`DEBUG: Successfully uploaded object image to Supabase: ${publicUrl}`);
                    
                    return {
                      supabaseUrl: publicUrl,
                      supabasePath: supabasePath,
                      fileName: fileName,
                      fileSize: imageData.length || 0,
                      fileType: 'image/jpeg',
                      caption: image.caption || 'Image'
                    };
                  } catch (error) {
                    console.error(`ERROR: Failed to upload object image to Supabase:`, error);
                    return {
                      ...image,
                      legacyBase64: image.image || image.buffer || image.blob
                    };
                  }
                }
                // If image is already a Supabase object, keep it
                else if (typeof image === 'object' && image.supabaseUrl) {
                  console.log(`DEBUG: Image already has Supabase URL: ${image.supabaseUrl}`);
                  return image;
                }
                // If image is a string but not Base64, convert to object
                else if (typeof image === 'string') {
                  console.log(`DEBUG: Converting string to object: ${image}`);
                  return {
                    legacyBase64: image,
                    caption: 'Legacy image'
                  };
                }
                // Otherwise, return as-is
                else {
                  console.log(`DEBUG: Keeping image as-is:`, typeof image, image);
                  return image;
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
    console.log("DEBUG: Processing carSheet images");
    
    const processedCarSheet = { ...reportData.carSheet };
    processedCarSheet.photo_groups = await Promise.all(
      reportData.carSheet.photo_groups.map(async (photoGroup) => {
        if (photoGroup.images && Array.isArray(photoGroup.images)) {
          const processedImages = await Promise.all(
            photoGroup.images.map(async (image) => {
              // Same logic as above for carSheet images
              if (typeof image === 'string' && image.startsWith('data:image/')) {
                console.log(`DEBUG: Uploading carSheet Base64 image to Supabase`);
                
                try {
                  const base64Data = image.split(',')[1];
                  const buffer = Buffer.from(base64Data, 'base64');
                  const fileName = `car-image-${Date.now()}.jpg`;
                  const supabasePath = `temp-uploads/${userId}/car-images/${fileName}`;
                  
                  const { data, error } = await uploadImageToSupabase(
                    buffer, 
                    supabasePath
                  );
                  
                  if (error) {
                    return { 
                      legacyBase64: image,
                      caption: image.caption || 'Car image'
                    };
                  }
                  
                  const { publicUrl } = await getPublicUrl(supabasePath);
                  
                  return {
                    supabaseUrl: publicUrl,
                    supabasePath: supabasePath,
                    fileName: fileName,
                    fileSize: buffer.length,
                    fileType: 'image/jpeg',
                    caption: image.caption || 'Car image'
                  };
                } catch (error) {
                  console.error(`ERROR: Failed to upload carSheet image to Supabase:`, error);
                  return { 
                    legacyBase64: image,
                    caption: image.caption || 'Car image'
                  };
                }
              }
              // If image is already a Supabase object, keep it
              else if (typeof image === 'object' && image.supabaseUrl) {
                return image;
              }
              else if (typeof image === 'string') {
                return {
                  legacyBase64: image,
                  caption: 'Legacy car image'
                };
              }
              else {
                return image;
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
  
  // Handle projectLogo
  if (reportData.projectLogo) {
    console.log("DEBUG: Processing projectLogo");
    
    if (typeof reportData.projectLogo === 'string' && reportData.projectLogo.startsWith('data:image/')) {
      console.log(`DEBUG: Uploading projectLogo Base64 to Supabase`);
      
      try {
        const base64Data = reportData.projectLogo.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        const fileName = `project-logo-${Date.now()}.jpg`;
        const supabasePath = `temp-uploads/${userId}/logos/${fileName}`;
        
        const { data, error } = await uploadImageToSupabase(
          buffer, 
          supabasePath
        );
        
        if (error) {
          processedData.projectLogo = { 
            legacyBase64: reportData.projectLogo
          };
        } else {
          const { publicUrl } = await getPublicUrl(supabasePath);
          
          processedData.projectLogo = {
            supabaseUrl: publicUrl,
            supabasePath: supabasePath,
            fileName: fileName,
            fileSize: buffer.length,
            fileType: 'image/jpeg'
          };
        }
      } catch (error) {
        console.error("ERROR: Failed to upload projectLogo:", error);
        processedData.projectLogo = { 
          legacyBase64: reportData.projectLogo
        };
      }
    } else if (typeof reportData.projectLogo === 'object' && reportData.projectLogo.supabaseUrl) {
      console.log(`DEBUG: projectLogo already has Supabase URL`);
      // Keep as-is
    } else {
      console.log(`DEBUG: Keeping projectLogo as-is:`, typeof reportData.projectLogo);
      // Keep as-is
    }
  }
  
    
  console.log("DEBUG: Image processing complete");
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
  console.log("DEBUG BACKEND SERVICE: saveOrUpdateReport called with:", {
    userId,
    projectName: reportData.projectName,
    reportDate: reportData.reportDate,
    location: reportData.location, // 🔍 DEBUG: Check if location is received
    allFields: Object.keys(reportData), // 🔍 DEBUG: Show all received fields
    // 🔍 NEW: Specific activities debugging
    hasActivities: 'activities' in reportData,
    activitiesData: reportData.activities,
    weeklyActivitiesCount: reportData.activities?.weeklyActivities?.length || 0,
    nextWeekPlanCount: reportData.activities?.nextWeekPlan?.length || 0
  });

  // 🚀 NEW: Process images through Supabase first!
  console.log("DEBUG: Processing images before saving to database");
  let processedReportData;
  try {
    processedReportData = await processReportImages(reportData, userId);
    console.log("DEBUG: Image processing complete, saving processed data");
  } catch (error) {
    console.error("ERROR: Failed to process images:", error);
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

    console.log("DEBUG BACKEND SERVICE: Searching for existing report:", {
      userId,
      projectName,
      location: reportData.location,
      startOfDay: startOfDay.toISOString(),
      endOfDay: endOfDay.toISOString(),
    });

    // Find existing report for this user, project, date, AND location
    const query = {
      userId,
      projectName,
      reportDate: { $gte: startOfDay, $lte: endOfDay },
    };
    
    // Add location to query if provided
    if (reportData.location) {
      query.location = reportData.location;
    }
    
    let report = await DailyReport.findOne(query).session(session);

    console.log(
      "DEBUG BACKEND SERVICE: Existing report found:",
      report ? "YES" : "NO"
    );

    // 🔥 FIX #1: Get the previous report with projectName AND location filter
    const previousReportQuery = {
      userId,
      projectName,  // ← CRITICAL FIX: Must match same project!
      reportDate: { $lt: startOfDay },
    };
    
    // Add location to previous report query if current location is provided
    if (reportData.location) {
      previousReportQuery.location = reportData.location;
    }
    
    const previousReport = await DailyReport.findOne(previousReportQuery)
      .sort({ reportDate: -1 })
      .session(session);

    console.log("DEBUG BACKEND SERVICE: Previous report found:", {
      found: previousReport ? "YES" : "NO",
      previousDate: previousReport?.reportDate?.toISOString(),
      previousProjectName: previousReport?.projectName
    });

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
        console.log(`DEBUG: Rolling total for "${item.description}":`, {
          prev: userPrev,
          today: today,
          accumulated: accumulated,
          foundPrevious: !!prevItem
        });
        
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
    console.log("DEBUG: Calculating rolling totals for managementTeam...");
    const managementTeam = calculateRollingTotals(
      reportData.managementTeam || [],
      previousReport?.managementTeam || []
    );

    console.log("DEBUG: Calculating rolling totals for workingTeamInterior...");
    const workingTeamInterior = calculateRollingTotals(
      reportData.workingTeamInterior || [],
      previousReport?.workingTeamInterior || []
    );

    console.log("DEBUG: Calculating rolling totals for workingTeamMEP...");
    const workingTeamMEP = calculateRollingTotals(
      reportData.workingTeamMEP || [],
      previousReport?.workingTeamMEP || []
    );

    // Keep backward compatibility for old workingTeam
    const workingTeam = calculateRollingTotals(
      reportData.workingTeam || [],
      previousReport?.workingTeam || []
    );

    console.log("DEBUG: Calculating rolling totals for materials...");
    const materials = calculateRollingTotals(
      reportData.materials || [],
      previousReport?.materials || []
    );

    // NEW: Handle activities data (no rolling totals needed for activities)
    const activities = reportData.activities || {
      weeklyActivities: [],
      nextWeekPlan: []
    };
    
    console.log("DEBUG: Processing activities data:", {
      weeklyActivitiesCount: activities.weeklyActivities?.length || 0,
      nextWeekPlanCount: activities.nextWeekPlan?.length || 0,
      weeklyActivities: activities.weeklyActivities,
      nextWeekPlan: activities.nextWeekPlan,
      source: "upsertDailyReport function"
    });

    console.log("DEBUG: Calculating rolling totals for machinery...");
    const machinery = calculateRollingTotals(
      reportData.machinery || [],
      previousReport?.machinery || []
    );

    if (report) {
      // Update existing report
      console.log(
        "DEBUG BACKEND SERVICE: Updating existing report:",
        report._id
      );
      
      // Update text fields with strategy using processed data
      report.location = updateTextField(report.location, processedReportData.location, 'replace');
      report.description = updateTextField(report.description, processedReportData.description, 'replace');
      report.workPlanNextDay = updateTextField(report.workPlanNextDay, processedReportData.workPlanNextDay, 'replace');
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
      report.site_ref = processedReportData.site_ref; // Use processed site_ref
      report.photo_groups = processedReportData.photo_groups; // Use processed photo_groups
      report.carSheet = processedReportData.carSheet; // Use processed carSheet
      report.projectLogo = processedReportData.projectLogo; // Use processed projectLogo
      
      console.log("🔍 DEBUG: Report before save:", {
        location: report.location,
        hasLocation: 'location' in report,
        locationType: typeof report.location
      });
      console.log("DEBUG: About to save report with activities:", report.activities);
      await report.save({ session });
      console.log("DEBUG: Report saved successfully with activities:", report.activities);
      console.log("DEBUG BACKEND SERVICE: Report updated successfully");
    } else {
      // Create new report
      console.log("DEBUG BACKEND SERVICE: Creating new report");
      
      const newReportData = {
        userId,
        companyId, // ← ADD THIS
        createdBy: userFullName, // ← ADD THIS: Auto-populate from authenticated user
        ...processedReportData, // 🚀 Use processed data with Supabase URLs
        managementTeam,
        workingTeamInterior,
        workingTeamMEP,
        workingTeam, // Keep backward compatibility
        materials,
        machinery,
        activities, // NEW: Add activities field
        reportDate: inputDate,
        status: "draft",
        lastUpdated: new Date(),
      };
      
      console.log("🔍 DEBUG: newReportData before save:", {
        location: newReportData.location,
        hasLocation: 'location' in newReportData,
        locationType: typeof newReportData.location,
        allKeys: Object.keys(newReportData)
      });
      console.log("🚀 DEBUG: Processed images data includes:", {
        hasHse: !!(newReportData.hse && Array.isArray(newReportData.hse)),
        hasSiteRef: !!(newReportData.site_ref && Array.isArray(newReportData.site_ref)),
        hasPhotoGroups: !!(newReportData.photo_groups && Array.isArray(newReportData.photo_groups)),
        hasCarSheet: !!(newReportData.carSheet && newReportData.carSheet.photo_groups),
        hasProjectLogo: !!newReportData.projectLogo
      });
      
      report = new DailyReport(newReportData);
      console.log("DEBUG: About to create new report with activities:", report.activities);
      await report.save({ session });
      console.log("DEBUG: New report created successfully with activities:", report.activities);
      console.log("DEBUG BACKEND SERVICE: New report created with ID:", report._id);
      
      // 🚀 NEW: Update project statistics for new reports
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
        console.log("DEBUG BACKEND SERVICE: Project stats updated for:", reportData.projectName);
      } catch (projectError) {
        console.error("DEBUG BACKEND SERVICE: Failed to update project stats:", projectError);
      }
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
    
    const futureReports = await DailyReport.find(futureReportsQuery)
      .sort({ reportDate: 1 })
      .session(session);

    if (futureReports.length > 0) {
      console.log(`DEBUG: Recalculating ${futureReports.length} future reports...`);
      await recalculateFutureReports(userId, projectName, futureReports, session);
    }

    await session.commitTransaction();
    console.log("DEBUG BACKEND SERVICE: Transaction committed successfully");
    return report;
  } catch (error) {
    console.error(
      "DEBUG BACKEND SERVICE: Transaction failed, aborting:",
      error
    );
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
  // DEBUG 4: What is Mongoose actually about to save?
  console.log("DEBUG BACKEND SERVICE: Submitting report ->", {
    userId,
    projectName,
    reportDate: reportDate.toISOString(),
  });

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
    
    console.log("DEBUG BACKEND SERVICE: Report submitted successfully:", existingReport._id);
    return existingReport;
  } catch (error) {
    console.error("DEBUG BACKEND SERVICE: Error submitting report:", error);
    throw error;
  }
};

/**
 * Create a new report with default/empty data
 * Always creates a new report, allows multiple reports per date/project
 */
const createNewReport = async (userId, projectName, reportDate, companyId) => {
  try {
    console.log("DEBUG BACKEND SERVICE: Creating new report for:", {
      userId,
      projectName,
      reportDate,
    });

    // Get user's full name for createdBy field
    const user = await User.findById(userId);
    const userFullName = user ? `${user.firstName} ${user.lastName}` : "";

  


    // No longer checking for existing reports - allow multiple reports per date/project
    // Create new report with default values
    const report = new DailyReport({
      userId,
      companyId,
      createdBy: userFullName, // ← ADD THIS: Auto-populate from authenticated user
      projectName: projectName || "Default Project",
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
      console.log("DEBUG BACKEND SERVICE: Project stats updated for:", projectName);
    } catch (projectError) {
      console.error("DEBUG BACKEND SERVICE: Failed to update project stats:", projectError);
      // Don't fail the report creation if project update fails
    }
    
    console.log("DEBUG BACKEND SERVICE: New report created with ID:", report._id);
    return report;
  } catch (error) {
    console.error("DEBUG BACKEND SERVICE: Error creating new report:", error);
    throw error;
  }
};

/**
 * Auto-save report (partial update) - optimized for frequent saves
 * Only updates changed fields, maintains rolling totals
 */
const autoSaveReport = async (userId, reportId, partialData) => {
  try {
    console.log("DEBUG BACKEND SERVICE: Auto-saving report:", { userId, reportId });
    
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
      .select('projectName reportDate status updatedAt createdAt submittedAt');

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
    console.log("DEBUG BACKEND SERVICE: Creating blank report for:", { userId, projectName });

    // Get user's full name for createdBy field
    const user = await User.findById(userId);
    const userFullName = user ? `${user.firstName} ${user.lastName}` : "";

    const report = new DailyReport({
      userId,
      createdBy: userFullName, // ← ADD THIS: Auto-populate from authenticated user
      projectName: projectName || "Untitled Report",
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

const getCompanyReports = async (companyId, page = 1, limit = 20, search = "", projectFilter = "") => {
  try {
    const skip = (page - 1) * limit;
    
    // Build search query
    let searchQuery = search ? {
      $and: [
        { companyId },
        { status: "submitted" },  // ← ADD THIS
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
      status: "submitted"  // ← ADD THIS
    };
    // ADD PROJECT FILTER
    if (projectFilter) {
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

const getReportsByLocation = async (userId, location = null) => {
  try {
    const query = { userId };
    
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
};
