const DailyReport = require('../models/dailyReportModel');
const WeeklyReport = require('../models/WeeklyReport');
const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');

/**
 * Type definition for aggregated photo
 * @typedef {Object} AggregatedPhoto
 * @property {string} date - Date string (YYYY-MM-DD)
 * @property {'HSE'|'SITE'} section - Section type
 * @property {string} image - Image URL or base64 data
 * @property {string} caption - Image caption
 * @property {string} source - Source daily report identifier
 * @property {string} [sectionTitle] - Original section title from daily report
 */

/**
 * Get the day of week mapping for a given date
 * @param {Date} date - The date to map
 * @returns {string} - The corresponding day key (fri, sat, sun, mon, tue, wed, thu)
 */
const getDayKey = (date) => {
  const dayOfWeek = date.getDay();
  const dayMap = {
    0: 'sun',
    1: 'mon',
    2: 'tue',
    3: 'wed',
    4: 'thu',
    5: 'fri',
    6: 'sat'
  };
  return dayMap[dayOfWeek];
};

/**
 * Format date to YYYY-MM-DD string
 * @param {Date} date - Date to format
 * @returns {string} - Formatted date string
 */
const formatDate = (date) => {
  return new Date(date).toISOString().split('T')[0];
};

/**
 * Extract image URL from various formats (string, object with supabaseUrl, etc.)
 * @param {string|Object} imageData - Image data which could be string URL or ImageMetadata object
 * @returns {string} - Extracted image URL or empty string
 */
const extractImageUrl = (imageData) => {
  if (!imageData) return '';
  
  // If it's a string, return it directly
  if (typeof imageData === 'string') return imageData;
  
  // If it's an object with supabaseUrl (ImageMetadata schema), return supabaseUrl
  if (typeof imageData === 'object') {
    return imageData.supabaseUrl || imageData.url || imageData.path || '';
  }
  
  return '';
};

/**
 * Aggregate HSE images from daily reports
 * Daily Report structure: hse[].images[] with parallel footers[] OR referenceSections[].entries[].slots[]
 * @param {Array} dailyReports - Array of daily reports
 * @param {number} maxPerReport - Maximum images to collect per daily report (default: unlimited)
 * @returns {Object} - Object with toolboxPhotos and activityPhotos arrays
 */
const aggregateHSEImages = (dailyReports, maxPerReport = Infinity) => {
  const toolboxPhotos = [];
  const activityPhotos = [];
  
  for (const report of dailyReports) {
    let toolboxCollected = 0; // Images collected for toolbox from this report
    let activityCollected = 0; // Images collected for activity from this report
    
    // First try to get images from hse field
    const hseSections = report.hse || [];
    for (const section of hseSections) {
      const images = section.images || [];
      const footers = section.footers || [];
      const sectionTitle = section.section_title?.toLowerCase() || '';
      
      // Determine if this is a toolbox meeting or activity photo section
      const isToolbox = sectionTitle.includes('toolbox') || sectionTitle.includes('meeting');
      const isActivity = sectionTitle.includes('activity') || !isToolbox;
      
      const targetArray = isToolbox ? toolboxPhotos : activityPhotos;
      
      // Get current count for this section type
      const getCurrentCount = () => isToolbox ? toolboxCollected : activityCollected;
      
      for (let i = 0; i < images.length; i++) {
        const imageUrl = extractImageUrl(images[i]);
        if (!imageUrl) continue;
        
        targetArray.push({
          date: formatDate(report.reportDate),
          section: 'HSE',
          image: imageUrl,
          caption: footers[i] || section.section_title || '',
          source: `daily-report-${report._id}`,
          sectionTitle: section.section_title || ''
        });
        
        if (isToolbox) {
          toolboxCollected++;
        } else {
          activityCollected++;
        }
      }
      
      // Stop processing hse sections if both limits reached
      if (toolboxCollected >= maxPerReport && activityCollected >= maxPerReport) break;
    }
    
    // Try referenceSections - each section type has its own limit
    if (report.referenceSections) {
      const refSections = Array.isArray(report.referenceSections) ? report.referenceSections : [];
      
      for (const section of refSections) {
        if (!section.entries) continue;
        
        const sectionTitle = section.title?.toLowerCase() || '';
        
        const isToolbox = sectionTitle.includes('toolbox') || sectionTitle.includes('meeting');
        const isActivity = sectionTitle.includes('activity') || !isToolbox;
        
        // Skip if this section type is already at limit
        if (isToolbox && toolboxCollected >= maxPerReport) continue;
        if (isActivity && activityCollected >= maxPerReport) continue;
        
        const targetArray = isToolbox ? toolboxPhotos : activityPhotos;
        
        for (const entry of section.entries) {
          if (!entry.slots) continue;
          
          for (const slot of entry.slots) {
            // Check if we've reached limit for this section type
            if (isToolbox && toolboxCollected >= maxPerReport) break;
            if (isActivity && activityCollected >= maxPerReport) break;
            
            const imageUrl = extractImageUrl(slot.image);
            if (!imageUrl) continue;
            
            targetArray.push({
              date: formatDate(report.reportDate),
              section: 'HSE',
              image: imageUrl,
              caption: slot.caption || section.title || '',
              source: `daily-report-${report._id}`,
              sectionTitle: section.title || ''
            });
            
            if (isToolbox) {
              toolboxCollected++;
            } else {
              activityCollected++;
            }
          }
          
          // Check if we've reached limit for this section type
          if (isToolbox && toolboxCollected >= maxPerReport) break;
          if (isActivity && activityCollected >= maxPerReport) break;
        }
      }
    }
  }
  
  return { toolboxPhotos, activityPhotos };
};

/**
 * Aggregate Site Activity images from daily reports
 * Daily Report structure: site_ref[].images[] with parallel footers[]
 * @param {Array} dailyReports - Array of daily reports
 * @param {number} maxPerReport - Maximum images to collect per daily report (default: unlimited)
 * @returns {Array<AggregatedPhoto>} - Aggregated Site photos
 */
const aggregateSiteImages = (dailyReports, maxPerReport = Infinity) => {
  const sitePhotos = [];
  
  for (const report of dailyReports) {
    const siteSections = report.site_ref || [];
    let collected = 0;
    
    for (const section of siteSections) {
      const images = section.images || [];
      const footers = section.footers || [];
      
      for (let i = 0; i < images.length; i++) {
        const imageUrl = extractImageUrl(images[i]);
        if (!imageUrl) continue;
        
        sitePhotos.push({
          date: formatDate(report.reportDate),
          section: 'SITE',
          image: imageUrl,
          caption: footers[i] || section.section_title || '',
          source: `daily-report-${report._id}`,
          sectionTitle: section.section_title || ''
        });
        collected++;
      }
      
      if (collected >= maxPerReport) break;
    }
  }
  
  return sitePhotos;
};

/**
 * Transform aggregated HSE photos to Weekly Report structure
 * Weekly Report structure: sections.hses.hsePhotoReferences.hseToolboxMeeting[] and hseActivityPhotos[]
 * @param {Object} photos - Object with toolboxPhotos and activityPhotos arrays
 * @returns {Object} - Weekly Report HSE photo references structure
 */
const transformHSEToWeeklyFormat = ({ toolboxPhotos, activityPhotos }) => {
  // Helper to split photos into entries with 2 slots each (mixed from all dates)
  const createEntries = (photos) => {
    const entries = [];
    const timestamp = Date.now();
    for (let i = 0; i < photos.length; i += 2) {
      entries.push({
        id: `entry-${timestamp}-${i}`,
        slots: photos.slice(i, i + 2).map((photo, idx) => ({
          id: `slot-${timestamp}-${i}-${idx}`,
          image: photo.image,
          caption: photo.caption
        }))
      });
    }
    return entries;
  };

  return {
    hseToolboxMeeting: toolboxPhotos.length > 0 ? [{
      id: `toolbox-${Date.now()}`,
      title: 'HSE Toolbox Meeting',
      entries: createEntries(toolboxPhotos)
    }] : [],
    hseActivityPhotos: activityPhotos.length > 0 ? [{
      id: `activity-${Date.now()}`,
      title: 'HSE Activity Photos',
      entries: createEntries(activityPhotos)
    }] : []
  };
};

/**
 * Transform aggregated Site photos to Weekly Report structure
 * Weekly Report structure: sections.photos.locations[].entries[].slots[]
 * @param {Array<AggregatedPhoto>} sitePhotos - Aggregated Site photos
 * @returns {Object} - Weekly Report photos section structure
 */
const transformSiteToWeeklyFormat = (sitePhotos) => {
  if (sitePhotos.length === 0) {
    return {
      title: 'Site Activities Photos',
      locations: []
    };
  }

  // Create entries with 2 slots each, mixing all photos from all dates
  const entries = [];
  const timestamp = Date.now();
  for (let i = 0; i < sitePhotos.length; i += 2) {
    const entryPhotos = sitePhotos.slice(i, i + 2);
    entries.push({
      id: `entry-${timestamp}-${i}`,
      slots: entryPhotos.map((photo, idx) => ({
        id: `slot-${timestamp}-${i}-${idx}`,
        image: photo.image,
        caption: photo.caption
      }))
    });
  }

  const locations = [{
    id: `location-${Date.now()}`,
    title: 'Site Activity Photos',
    entries
  }];

  return {
    title: 'Site Activities Photos',
    locations
  };
};

/**
 * Main function to aggregate images from daily reports for a weekly report
 * @param {string} projectIdentifier - Project name or projectId
 * @param {Date} startDate - Week start date (Friday)
 * @param {Date} endDate - Week end date (Thursday)
 * @param {Object} options - Options for aggregation
 * @param {boolean} options.useProjectId - Whether to use projectId instead of projectName
 * @param {number} options.maxImagesPerReport - Max images to collect per daily report (default: unlimited)
 * @returns {Promise<Object>} - Aggregated image data for weekly report
 */
const aggregateImages = async (projectIdentifier, startDate, endDate, options = {}) => {
  const { 
    useProjectId = false, 
    maxImagesPerReport = Infinity 
  } = options;
  
  try {
    // Ensure dates are Date objects
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Validate date range
    if (start > end) {
      throw new Error('Start date must be before end date');
    }
    
    console.log(`[ImageAggregation] Fetching daily reports for project: ${projectIdentifier}, dates: ${start.toISOString()} to ${end.toISOString()}`);
    
    // Normalize to cover the full calendar day in server local time
    const queryStart = new Date(start);
    queryStart.setHours(0, 0, 0, 0);

    const queryEnd = new Date(end);
    queryEnd.setHours(23, 59, 59, 999);
    
    // Build query
    const query = useProjectId && mongoose.Types.ObjectId.isValid(projectIdentifier)
      ? { 
          projectId: new mongoose.Types.ObjectId(projectIdentifier), 
          reportDate: { $gte: queryStart, $lte: queryEnd } 
        }
      : { 
          projectName: projectIdentifier, 
          reportDate: { $gte: queryStart, $lte: queryEnd } 
        };
    
    console.log('[ImageAggregation] MongoDB query:', JSON.stringify(query));
    
    // Fetch daily reports with only needed fields
    const dailyReports = await DailyReport.find(query)
      .select({
        reportDate: 1,
        hse: 1,
        site_ref: 1,
        referenceSections: 1,
        projectId: 1,
        projectName: 1
      })
      .sort({ reportDate: 1 })
      .lean();
    
    console.log(`[ImageAggregation] Found ${dailyReports.length} daily reports`);
    
    // Aggregate images
    const { toolboxPhotos, activityPhotos } = aggregateHSEImages(dailyReports, maxImagesPerReport);
    const sitePhotos = aggregateSiteImages(dailyReports, maxImagesPerReport);
    
    console.log(`[ImageAggregation] Aggregated ${toolboxPhotos.length} Toolbox photos, ${activityPhotos.length} Activity photos, and ${sitePhotos.length} Site photos`);
    
    // Transform to weekly report format
    const hsePhotoReferences = transformHSEToWeeklyFormat({ toolboxPhotos, activityPhotos });
    const photosSection = transformSiteToWeeklyFormat(sitePhotos);
    
    return {
      success: true,
      data: {
        hsePhotos: [...toolboxPhotos, ...activityPhotos],
        sitePhotos,
        hsePhotoReferences,
        photosSection,
        dailyReportCount: dailyReports.length,
        hsePhotoCount: toolboxPhotos.length + activityPhotos.length,
        sitePhotoCount: sitePhotos.length
      },
      message: `Successfully aggregated ${toolboxPhotos.length + activityPhotos.length} HSE photos and ${sitePhotos.length} Site photos from ${dailyReports.length} daily reports`
    };
    
  } catch (error) {
    console.error('[ImageAggregation] Error aggregating images:', error);
    return {
      success: false,
      error: 'Failed to aggregate images from daily reports',
      details: error.message
    };
  }
};

/**
 * Update weekly report with aggregated images
 * @param {string} reportId - Weekly report ID
 * @param {Object} options - Options for aggregation
 * @returns {Promise<Object>} - Update result
 */
const updateWeeklyReportImages = async (reportId, options = {}) => {
  try {
    // Get the weekly report
    const weeklyReport = await WeeklyReport.findById(reportId);
    if (!weeklyReport) {
      return {
        success: false,
        error: 'Weekly report not found'
      };
    }
    
    let { projectId, projectName, startDate } = weeklyReport;
    let { endDate } = weeklyReport;
    
    // If projectId is missing but projectName exists, try to resolve projectId
    if (!projectId && projectName) {
      try {
        const Project = require('../models/projectModel');
        const project = await Project.findOne({
          name: { $regex: new RegExp(`^${projectName}$`, 'i') },
          isActive: true
        });
        if (project) {
          projectId = project._id;
          weeklyReport.projectId = projectId;
          console.log(`[updateWeeklyReportImages] Resolved projectId ${projectId} from projectName: ${projectName}`);
        }
      } catch (err) {
        console.warn('[updateWeeklyReportImages] Could not resolve projectId from projectName:', err);
      }
    }
    
    // If still no projectId, return error
    if (!projectId) {
      return {
        success: false,
        error: 'Cannot aggregate images: Weekly report is missing projectId. Please update the report with a valid project.',
        details: 'The weekly report must have a valid projectId to aggregate images from daily reports'
      };
    }

    // If endDate is missing or not after startDate, derive it as startDate + 6 days
    if (!endDate || new Date(startDate) >= new Date(endDate)) {
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
      console.warn(`[updateWeeklyReportImages] Invalid date range for report ${reportId}, using startDate + 6 days as endDate`);
    }

    // Determine project identifier
    const useProjectId = !!projectId;
    const projectIdentifier = projectId ? projectId.toString() : projectName;

    // Aggregate images
    const aggregationResult = await aggregateImages(
      projectIdentifier,
      startDate,
      endDate,
      { useProjectId, ...options }
    );
    
    if (!aggregationResult.success) {
      return aggregationResult;
    }
    
    const { hsePhotoReferences, photosSection } = aggregationResult.data;
    
    // Update the weekly report with aggregated images
    // Ensure hses section exists
    if (!weeklyReport.sections.hses) {
      weeklyReport.sections.hses = {};
    }
    
    // Update HSE photo references
    weeklyReport.sections.hses.hsePhotoReferences = hsePhotoReferences;
    
    // Update photos section
    weeklyReport.sections.photos = photosSection;
    
    weeklyReport.markModified('sections.hses');
    weeklyReport.markModified('sections.photos');
    weeklyReport.markModified('projectId'); // Mark projectId as modified if it was resolved
    
    await weeklyReport.save();
    
    return {
      success: true,
      data: weeklyReport,
      aggregated: {
        hsePhotoCount: aggregationResult.data.hsePhotos.length,
        sitePhotoCount: aggregationResult.data.sitePhotos.length,
        dailyReportCount: aggregationResult.data.dailyReportCount
      },
      message: `Weekly report images updated successfully: ${aggregationResult.data.hsePhotos.length} HSE photos, ${aggregationResult.data.sitePhotos.length} Site photos`
    };
    
  } catch (error) {
    console.error('[ImageAggregation] Error updating weekly report images:', error);
    return {
      success: false,
      error: 'Failed to update weekly report images',
      details: error.message
    };
  }
};

module.exports = {
  aggregateImages,
  updateWeeklyReportImages,
  aggregateHSEImages,
  aggregateSiteImages,
  transformHSEToWeeklyFormat,
  transformSiteToWeeklyFormat,
  extractImageUrl,
  getDayKey,
  formatDate
};
