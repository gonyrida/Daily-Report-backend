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
 * @param {number} maxPerReport - Maximum images to collect per daily report (default: 2)
 * @returns {Object} - Object with toolboxPhotos and activityPhotos arrays
 */
const aggregateHSEImages = (dailyReports, maxPerReport = 2) => {
  const toolboxPhotos = [];
  const activityPhotos = [];
  
  for (const report of dailyReports) {
    let reportCollected = 0; // Total images collected from this daily report
    
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
      
      for (let i = 0; i < images.length && reportCollected < maxPerReport; i++) {
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
        
        reportCollected++;
      }
      
      if (reportCollected >= maxPerReport) break;
    }
    
    // If still under limit, try referenceSections
    if (reportCollected < maxPerReport && report.referenceSections) {
      const refSections = Array.isArray(report.referenceSections) ? report.referenceSections : [];
      
      for (const section of refSections) {
        if (!section.entries) continue;
        
        const sectionTitle = section.title?.toLowerCase() || '';
        
        const isToolbox = sectionTitle.includes('toolbox') || sectionTitle.includes('meeting');
        const isActivity = sectionTitle.includes('activity') || !isToolbox;
        
        const targetArray = isToolbox ? toolboxPhotos : activityPhotos;
        
        for (const entry of section.entries) {
          if (!entry.slots) continue;
          
          for (const slot of entry.slots) {
            if (reportCollected >= maxPerReport) break;
            
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
            
            reportCollected++;
          }
          
          if (reportCollected >= maxPerReport) break;
        }
        
        if (reportCollected >= maxPerReport) break;
      }
    }
  }
  
  return { toolboxPhotos, activityPhotos };
};

/**
 * Aggregate Site Activity images from daily reports
 * Daily Report structure: site_ref[].images[] with parallel footers[]
 * @param {Array} dailyReports - Array of daily reports
 * @param {number} maxPerReport - Maximum images to collect per daily report (default: 2)
 * @returns {Array<AggregatedPhoto>} - Aggregated Site photos
 */
const aggregateSiteImages = (dailyReports, maxPerReport = 2) => {
  const sitePhotos = [];
  
  for (const report of dailyReports) {
    const siteSections = report.site_ref || [];
    let collected = 0;
    
    for (const section of siteSections) {
      const images = section.images || [];
      const footers = section.footers || [];
      
      for (let i = 0; i < images.length && collected < maxPerReport; i++) {
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
  // Helper to split photos into entries with 2 slots each
  const createEntries = (photos) => {
    const entries = [];
    for (let i = 0; i < photos.length; i += 2) {
      entries.push({
        id: `entry-${Date.now()}-${i}`,
        slots: photos.slice(i, i + 2).map((photo, idx) => ({
          id: `slot-${i + idx}`,
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

  // Group photos by date
  const photosByDate = {};
  for (const photo of sitePhotos) {
    const date = photo.date || 'Unknown';
    if (!photosByDate[date]) {
      photosByDate[date] = [];
    }
    photosByDate[date].push(photo);
  }

  // Create ONE section with multiple entries (one entry per date)
  const entries = [];
  let entryIndex = 0;

  for (const [date, photos] of Object.entries(photosByDate)) {
    // Each entry holds up to 2 photos from the same date
    for (let i = 0; i < photos.length; i += 2) {
      const entryPhotos = photos.slice(i, i + 2);
      entries.push({
        id: `entry-${Date.now()}-${entryIndex}`,
        slots: entryPhotos.map((photo, idx) => ({
          id: `slot-${entryIndex}-${idx}`,
          image: photo.image,
          caption: photo.caption
        }))
      });
      entryIndex++;
    }
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
 * @param {number} options.maxImagesPerReport - Max images to collect per daily report (default: 2)
 * @returns {Promise<Object>} - Aggregated image data for weekly report
 */
const aggregateImages = async (projectIdentifier, startDate, endDate, options = {}) => {
  const { 
    useProjectId = false, 
    maxImagesPerReport = 2 
  } = options;
  
  try {
    // Ensure dates are Date objects
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Validate date range
    if (start >= end) {
      throw new Error('Start date must be before end date');
    }
    
    console.log(`[ImageAggregation] Fetching daily reports for project: ${projectIdentifier}, dates: ${start.toISOString()} to ${end.toISOString()}`);
    
    // Normalize dates for MongoDB query
    const queryStart = new Date(start);
    if (start.toTimeString() === '00:00:00 GMT') {
      queryStart.setHours(7, 0, 0, 0); // Cambodia timezone offset
    } else {
      queryStart.setHours(0, 0, 0, 0);
    }
    
    const queryEnd = new Date(end);
    if (end.toTimeString() === '00:00:00 GMT') {
      queryEnd.setHours(30, 59, 59, 999); // End of day in Cambodia timezone
    } else {
      queryEnd.setHours(23, 59, 59, 999);
    }
    
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
    
    const { projectId, projectName, startDate, endDate } = weeklyReport;
    
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
