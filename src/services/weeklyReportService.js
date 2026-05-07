const WeeklyReport = require('../models/WeeklyReport');
const DailyReport = require('../models/dailyReportModel'); // NEW: Import Daily Report model
const { aggregateManpowerData, updateWeeklyReportManpower } = require('../utils/manpowerAggregation');
const { aggregateImages, updateWeeklyReportImages } = require('../utils/imageAggregation');
const mongoose = require('mongoose'); // ← ADD THIS

/**
 * Calculate week start (Friday) and end (Thursday) dates for a given week number
 * @param {number} weekNumber - Week number (1-53)
 * @param {number} year - Year (defaults to current year)
 * @returns {Object} - { startDate, endDate }
 */
const getWeekDates = (weekNumber, year = new Date().getFullYear()) => {
  // Get first day of the year
  const firstDayOfYear = new Date(year, 0, 1);
  
  // Find the first Friday of the year (week starts on Friday)
  const dayOfWeek = firstDayOfYear.getDay(); // 0 = Sunday, 5 = Friday
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
  const firstFriday = new Date(year, 0, 1 + daysUntilFriday);
  
  // Calculate start date (Friday) for the given week number
  const startDate = new Date(firstFriday);
  startDate.setDate(firstFriday.getDate() + (weekNumber - 1) * 7);
  
  // End date is Thursday (6 days after Friday)
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  
  return { startDate, endDate };
};

/**
 * Transform frontend activity data to backend format
 * Since schemas now match, this is mostly validation and defaults
 */
const transformActivitiesToBackend = (activities) => {
  return activities.map(activity => ({
    description: activity.description || "",
    percent: activity.percent || 0,
    percentage: activity.percentage || (activity.percent ? activity.percent.toString() : "0"), // Legacy field
    source: activity.source || "manual",
    bulkImportId: activity.bulkImportId,
    addedAt: activity.addedAt || new Date()
  }));
};

/**
 * Transform backend activity data to frontend format
 * Since schemas now match, this is mostly validation
 */
const transformActivitiesToFrontend = (activities) => {
  return activities.map(activity => ({
    description: activity.description || "",
    percent: activity.percent || 0,
    percentage: activity.percentage, // Keep legacy field if present
    source: activity.source || "manual",
    bulkImportId: activity.bulkImportId,
    addedAt: activity.addedAt
  }));
};

/**
 * Handle legacy activity data migration
 */
const migrateLegacyActivities = (legacyActivities) => {
  return legacyActivities.map(activity => ({
    description: activity.description || "",
    percent: activity.percentage ? parseFloat(activity.percentage) : 0,
    source: "manual", // Legacy data is always manual
    bulkImportId: undefined,
    addedAt: activity.addAt || new Date(),
    // Keep legacy structure for compatibility
    percentage: activity.percentage || "0",
    subActivities: activity.subActivities || []
  }));
};

/**
 * Get paginated weekly reports for a user
 */
const getAllReports = async (userId, options = {}) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      projectName,
      projectId,
      startDate,
      endDate,
      searchTerm,
      filterStatus,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      metaOnly = false
    } = options;

    const skip = (page - 1) * limit;
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Build query
    const query = {};

    // Add userId filter - only return reports belonging to the current user
    if (userId) {
      query.userId = new mongoose.Types.ObjectId(userId);
    }

    // Add status filtering
    if (status) {
      query.status = status;
    } else if (filterStatus && filterStatus !== 'all') {
      query.status = filterStatus;
    }
    
    // Prioritize projectId if available, fallback to projectName
    if (projectId) {
      query.projectId = new mongoose.Types.ObjectId(projectId);
    } else if (projectName) {
      query.projectName = new RegExp(projectName, 'i');
    }
    
    // Add date range filtering
    if (startDate || endDate) {
      query.startDate = {};
      if (startDate) {
        query.startDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.startDate.$lte = new Date(endDate);
      }
    }

    // Add search functionality
    if (searchTerm && searchTerm.trim()) {
      const searchRegex = new RegExp(searchTerm.trim(), 'i');
      query.$or = [
        { projectName: searchRegex },
        { weekNumber: !isNaN(parseInt(searchTerm)) ? parseInt(searchTerm) : undefined },
        { status: searchRegex }
      ].filter(Boolean);
    }

    // Define projection for metadata-only requests
    const projection = metaOnly ? {
      _id: 1,
      projectName: 1,
      projectId: 1,
      weekNumber: 1,
      startDate: 1,
      endDate: 1,
      status: 1,
      userId: 1,
      createdAt: 1,
      updatedAt: 1,
      submittedAt: 1,
      // Include minimal sections data for display
      'sections.cover.dateRange': 1
    } : {};

    const reports = await WeeklyReport.find(query, projection)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await WeeklyReport.countDocuments(query);

    return {
      success: true,
      data: reports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    };
  } catch (error) {
    console.error('Error getting weekly reports:', error);
    return {
      success: false,
      error: 'Failed to retrieve weekly reports',
      details: error.message
    };
  }
};

/**
 * Get a single weekly report by ID
 */
const getReportById = async (reportId, userId, companyId) => {
  try {
    // First try to find user's own report
    let report = await WeeklyReport.findOne({ _id: reportId, userId })
      .lean();

    // If not found and user has companyId, try company-wide access for submitted reports
    if (!report && companyId) {
      report = await WeeklyReport.findOne({ _id: reportId, companyId, status: 'submitted' })
        .lean();
    }

    if (!report) {
      return {
        success: false,
        error: 'Weekly report not found'
      };
    }

    return {
      success: true,
      data: report
    };
  } catch (error) {
    console.error('Get weekly report by ID error:', error);
    return {
      success: false,
      error: 'Failed to retrieve weekly report',
      details: error.message
    };
  }
};

/**
 * Create a new weekly report
 */
const createReport = async (userId, companyId, reportData) => {
  try {
    // Calculate proper week dates if not provided
    let { startDate, endDate } = reportData;
    if (!startDate || !endDate) {
      const weekDates = getWeekDates(reportData.weekNumber || 1);
      startDate = weekDates.startDate;
      endDate = weekDates.endDate;
    }
    
    // Ensure sections object exists and has introduction with proper defaults
    const sections = {
      ...reportData.sections,
      introduction: {
        projectOverview: reportData.sections?.introduction?.projectOverview || "",
        designNConstruction: reportData.sections?.introduction?.designNConstruction || "",
        coverImage: reportData.sections?.introduction?.coverImage || ""
      },
      // Explicitly preserve masterSchedule to prevent losing it
      masterSchedule: reportData.sections?.masterSchedule || []
    };

    // Resolve projectId: use provided value, otherwise look it up by project name
    let resolvedProjectId = null;
    
    // First, try to use provided projectId (convert string to ObjectId if needed)
    if (reportData.projectId) {
      try {
        // Check if it's already a valid ObjectId
        if (mongoose.Types.ObjectId.isValid(reportData.projectId)) {
          resolvedProjectId = new mongoose.Types.ObjectId(reportData.projectId);
        } else if (typeof reportData.projectId === 'object' && reportData.projectId._id) {
          // Handle case where projectId is an object
          resolvedProjectId = reportData.projectId;
        }
      } catch (err) {
        console.warn('[createReport] Invalid projectId provided:', reportData.projectId);
      }
    }
    
    // If no valid projectId yet, look it up by project name
    if (!resolvedProjectId && reportData.projectName && companyId) {
      try {
        const Project = require('../models/projectModel');
        const project = await Project.findOne({
          name: { $regex: new RegExp(`^${reportData.projectName}$`, 'i') },
          companyId,
          isActive: true
        });
        if (project) {
          resolvedProjectId = project._id;
          console.log(`[createReport] Resolved projectId from project name: ${resolvedProjectId}`);
        }
      } catch (err) { 
        console.warn('[createReport] Error looking up project by name:', err);
      }
    }
    
    // Validate that we have a projectId - it's required
    if (!resolvedProjectId) {
      return {
        success: false,
        error: 'projectId is required. Please provide a valid projectId or projectName',
        details: 'Could not resolve projectId from provided data'
      };
    }

    const report = new WeeklyReport({
      projectName: reportData.projectName,
      projectId: resolvedProjectId,
      weekNumber: reportData.weekNumber,
      startDate,
      endDate,
      sections: sections,  // Use the sections object directly
      userId,
      companyId,  // ← ADD THIS
      status: 'draft',
      version: 1
    });

    // Explicitly set masterSchedule after document creation
    report.sections.masterSchedule = sections.masterSchedule || [];
    report.markModified('sections');
    report.markModified('sections.masterSchedule');

    // Save with validation enabled (projectId is now required and properly set)
    const savedReport = await report.save();

    // Force masterSchedule to be saved correctly if it exists
    if (sections.masterSchedule && sections.masterSchedule.length > 0) {
      savedReport.sections.masterSchedule = sections.masterSchedule;
      savedReport.markModified('sections.masterSchedule');
      await savedReport.save();
    }

    return {
      success: true,
      data: savedReport,
      message: 'Weekly report created successfully'
    };
  } catch (error) {
    console.error('Error creating weekly report:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return {
        success: false,
        error: 'Validation failed',
        details: errors
      };
    }

    return {
      success: false,
      error: 'Failed to create weekly report',
      details: error.message
    };
  }
};

/**
 * Update a weekly report (full or partial)
 */
const updateReport = async (reportId, userId, updateData) => {
  try {
    // First check if report exists and belongs to user
    const existingReport = await WeeklyReport.findOne({ 
      _id: reportId, 
      userId 
    });

    if (!existingReport) {
      return {
        success: false,
        error: 'Weekly report not found or access denied'
      };
    }

  
    // Optimistic locking check
    if (updateData.version && existingReport.version !== updateData.version) {
      return {
        success: false,
        error: 'Report has been modified by another user. Please refresh and try again.'
      };
    }

    // Merge update data
    const existingData = existingReport.toObject();
    const updatedData = {
      ...existingData,
      updatedAt: new Date(),
      version: (existingData.version || 1) + 1
    };

    // Handle sections merge properly
    if (updateData.sections) {
      updatedData.sections = {
        ...existingData.sections,
        ...updateData.sections
      };
    }

    // DEBUG: Log merged HSES data before save
    if (updatedData.sections?.hses) {
    }

    // Merge other non-section properties
    Object.keys(updateData).forEach(key => {
      if (key !== 'sections') {
        updatedData[key] = updateData[key];
      }
    });
    
    // Handle projectId conversion if provided
    if (updateData.projectId) {
      try {
        if (mongoose.Types.ObjectId.isValid(updateData.projectId)) {
          updatedData.projectId = new mongoose.Types.ObjectId(updateData.projectId);
        } else if (typeof updateData.projectId === 'object' && updateData.projectId._id) {
          updatedData.projectId = updateData.projectId;
        }
      } catch (err) {
        console.warn('[updateReport] Invalid projectId provided:', updateData.projectId);
        delete updatedData.projectId; // Remove invalid projectId to prevent validation errors
      }
    }

    // Ensure introduction section exists with proper defaults
    if (updatedData.sections) {
      updatedData.sections.introduction = {
        projectOverview: updatedData.sections.introduction?.projectOverview || "",
        designNConstruction: updatedData.sections.introduction?.designNConstruction || "",
        coverImage: updatedData.sections.introduction?.coverImage || ""
      };
      // Explicitly preserve masterSchedule to prevent losing it
      if (!updatedData.sections.masterSchedule) {
        updatedData.sections.masterSchedule = existingData.sections?.masterSchedule || [];
      }
    }

    // Update the document directly to handle nested array modifications
    const reportToUpdate = await WeeklyReport.findById(reportId);
    if (!reportToUpdate) {
      return {
        success: false,
        error: 'Weekly report not found'
      };
    }

    // Apply updates
    Object.assign(reportToUpdate, updatedData);

    // Mark nested sections as modified to ensure proper saving
    if (updatedData.sections?.photos) {
      reportToUpdate.markModified('sections.photos');
    }
    if (updatedData.sections?.hses) {
      reportToUpdate.markModified('sections.hses');
    }

    const updatedReport = await reportToUpdate.save({ runValidators: true });

    // DEBUG: Log saved HSES data
    if (updatedReport?.sections?.hses) {
    }

    return {
      success: true,
      data: updatedReport,
      message: 'Weekly report updated successfully'
    };
  } catch (error) {
    console.error('Error updating weekly report:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return {
        success: false,
        error: 'Validation failed',
        details: errors
      };
    }

    return {
      success: false,
      error: 'Failed to update weekly report',
      details: error.message
    };
  }
};

/**
 * Delete a weekly report (soft delete)
 */
const deleteReport = async (reportId, userId) => {
  try {
    const report = await WeeklyReport.findOne({ 
      _id: reportId, 
      userId 
    });

    if (!report) {
      return {
        success: false,
        error: 'Weekly report not found or access denied'
      };
    }

    // Soft delete by updating status
    await WeeklyReport.findByIdAndUpdate(
      reportId,
      { 
        status: 'deleted',
        updatedAt: new Date()
      }
    );

    return {
      success: true,
      message: 'Weekly report deleted successfully'
    };
  } catch (error) {
    console.error('Error deleting weekly report:', error);
    return {
      success: false,
      error: 'Failed to delete weekly report',
      details: error.message
    };
  }
};

/**
 * Submit a weekly report
 */
const submitReport = async (reportId, userId) => {
  try {
    const report = await WeeklyReport.findOne({ 
      _id: reportId, 
      userId 
    });

    if (!report) {
      return {
        success: false,
        error: 'Weekly report not found or access denied'
      };
    }

    // Allow re-submission of already submitted reports
    // if (report.status !== 'draft' && report.status !== 'in-progress') {
    //   return {
    //     success: false,
    //     error: 'Only draft or in-progress reports can be submitted'
    //   };
    // }

    const updatedReport = await WeeklyReport.findByIdAndUpdate(
      reportId,
      {
        status: 'submitted',
        submittedAt: new Date(),
        submittedBy: userId,
        updatedAt: new Date(),
        version: (report.version || 1) + 1
      },
      { new: true }
    ).lean();

    return {
      success: true,
      data: updatedReport,
      message: 'Weekly report submitted successfully'
    };
  } catch (error) {
    console.error('Error submitting weekly report:', error);
    return {
      success: false,
      error: 'Failed to submit weekly report',
      details: error.message
    };
  }
};

/**
 * Approve a weekly report
 */
const approveReport = async (reportId, userId) => {
  try {
    const report = await WeeklyReport.findOne({ 
      _id: reportId, 
      userId 
    });

    if (!report) {
      return {
        success: false,
        error: 'Weekly report not found or access denied'
      };
    }

    if (report.status !== 'submitted') {
      return {
        success: false,
        error: 'Only submitted reports can be approved'
      };
    }

    const updatedReport = await WeeklyReport.findByIdAndUpdate(
      reportId,
      {
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: userId,
        updatedAt: new Date(),
        version: (report.version || 1) + 1
      },
      { new: true }
    ).lean();

    return {
      success: true,
      data: updatedReport,
      message: 'Weekly report approved successfully'
    };
  } catch (error) {
    console.error('Error approving weekly report:', error);
    return {
      success: false,
      error: 'Failed to approve weekly report',
      details: error.message
    };
  }
};

/**
 * Reject a weekly report
 */
const rejectReport = async (reportId, userId, reason) => {
  try {
    const report = await WeeklyReport.findOne({ 
      _id: reportId, 
      userId 
    });

    if (!report) {
      return {
        success: false,
        error: 'Weekly report not found or access denied'
      };
    }

    if (report.status !== 'submitted') {
      return {
        success: false,
        error: 'Only submitted reports can be rejected'
      };
    }

    // Add rejection reason to introduction section
    const updatedSections = {
      ...report.sections,
      introduction: {
        ...report.sections.introduction,
        projectOverview: `${report.sections.introduction?.projectOverview || ''}\n\nREJECTION: ${reason || 'No reason provided'}`
      }
    };

    const updatedReport = await WeeklyReport.findByIdAndUpdate(
      reportId,
      {
        status: 'rejected',
        sections: updatedSections,
        updatedAt: new Date(),
        version: (report.version || 1) + 1
      },
      { new: true }
    ).lean();

    return {
      success: true,
      data: updatedReport,
      message: 'Weekly report rejected successfully'
    };
  } catch (error) {
    console.error('Error rejecting weekly report:', error);
    return {
      success: false,
      error: 'Failed to reject weekly report',
      details: error.message
    };
  }
};

/**
 * Auto-save weekly report (for real-time saving)
 */
const autoSaveReport = async (reportId, userId, updateData) => {
  try {
    const existingReport = await WeeklyReport.findOne({ 
      _id: reportId, 
      userId 
    });

    if (!existingReport) {
      return {
        success: false,
        error: 'Weekly report not found or access denied'
      };
    }

    // Only auto-save if report is in draft or in-progress status
    if (existingReport.status !== 'draft' && existingReport.status !== 'in-progress') {
      return {
        success: false,
        error: 'Cannot auto-save submitted, approved, or rejected reports'
      };
    }

    const updatedReport = await WeeklyReport.findByIdAndUpdate(
      reportId,
      {
        ...updateData,
        updatedAt: new Date(),
        version: (existingReport.version || 1) + 1
      },
      { new: true, runValidators: false } // Skip validation for auto-save
    ).lean();

    return {
      success: true,
      data: updatedReport
    };
  } catch (error) {
    console.error('Error auto-saving weekly report:', error);
    return {
      success: false,
      error: 'Failed to auto-save weekly report',
      details: error.message
    };
  }
};

/**
 * Get weekly report template
 */
const getTemplate = async (projectName, weekNumber = 1) => {
  try {
    // Calculate proper week dates
    const { startDate, endDate } = getWeekDates(weekNumber);
    
    const template = {
      projectName,
      weekNumber,
      startDate,
      endDate,
      status: 'draft',
      sections: {
        cover: {
          projectName,
          reportTitle: 'Weekly Progress Report',
          weekNumber: '1',
          dateRange: '',
          coverImage: '',
          projectTitle: '',
          employer: '',
          contractorName: 'Cambodian Advanced Construction Project Management (CACPM) Co., Ltd'
        },
        letter: {
          refNoPrefix: '',
          weekNumber: '',
          reportDate: '',
          recipientCompany: '',
          recipientLocation: '',
          recipientName: '',
          ccList: [],
          letterBody: '',
          signatureImage: '',
          signatoryName: '',
          signatoryPosition: '',
          constructorName: '',
          companyLocation: '',
          companyPhone1: '',
          companyPhone2: '',
          companyEmail1: '',
          companyEmail2: ''
        },
        introduction: {
          projectOverview: '',
          designNConstruction: '',
          coverImage: ''
        },
        overallProgress: {
          rows: []
        },
        constructionProgress: {
          projectInfo: {
            project: '',
            subtitle: '',
            date: '',
            revision: ''
          },
          items: []
        },
        activities: {
          weeklyActivities: [
            {
              description: '',
              percent: 0,
              source: 'manual',
              addedAt: new Date(),
              // Legacy compatibility
              percentage: '',
              subActivities: [
                {
                  description: '',
                  percentage: '',
                  subActivities: [
                    {
                      description: '',
                      percentage: '',
                      subActivities: [
                        {
                          description: '',
                          percentage: ''
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ],
          nextWeekPlan: [
            {
              description: '',
              percent: 0,
              source: 'manual',
              addedAt: new Date(),
              // Legacy compatibility
              percentage: '',
              subActivities: [
                {
                  description: '',
                  percentage: '',
                  subActivities: [
                    {
                      description: '',
                      percentage: '',
                      subActivities: [
                        {
                          description: '',
                          percentage: ''
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        },
        qaqcStatus: {
          ncr: {
            items: [
              {
                code: '',
                description: '',
                status: '',
                dateResponded: ''
              }
            ],
            comments: ''
          },
          car: {
            items: [
              {
                code: '',
                description: '',
                status: '',
                dateResponded: ''
              }
            ],
            comments: ''
          },
          scar: {
            items: [
              {
                code: '',
                description: '',
                status: '',
                dateResponded: ''
              }
            ],
            comments: ''
          },
          pmsi: {
            items: [
              {
                code: '',
                description: '',
                status: '',
                dateResponded: ''
              }
            ],
            comments: ''
          },
          csi: {
            items: [
              {
                code: '',
                description: '',
                issuedBy: '',
                issuedDate: '',
                status: '',
                dateResponded: ''
              }
            ],
            comments: ''
          },
          ir: {
            items: [
              {
                code: '',
                description: '',
                receivedDate: '',
                inspectionDate: '',
                status: '',
                dateResponded: ''
              }
            ],
            comments: ''
          },
          mfa: {
            items: [
              {
                code: '',
                description: '',
                status: '',
                dateResponded: ''
              }
            ],
            comments: ''
          },
          rfi: {
            items: [
              {
                code: '',
                description: '',
                status: '',
                dateResponded: ''
              }
            ],
            comments: ''
          },
          rfa: {
            items: [
              {
                code: '',
                description: '',
                status: '',
                dateResponded: ''
              }
            ],
            comments: ''
          },
          fcr: {
            items: [
              {
                code: '',
                description: '',
                status: '',
                dateResponded: ''
              }
            ],
            comments: ''
          },
          vo: {
            items: [
              {
                code: '',
                description: '',
                status: '',
                dateResponded: ''
              }
            ],
            comments: ''
          },
          tr: {
            items: [
              {
                code: '',
                description: '',
                status: '',
                dateResponded: ''
              }
            ],
            comments: ''
          },
          mir: {
            items: [
              {
                code: '',
                description: '',
                status: '',
                dateResponded: ''
              }
            ],
            comments: ''
          }
        },
        hses: {
          training: [
            {
              typeOfTraining: '',
              date: '',
              venue: '',
              trainer: '',
              attendee: '',
              remarks: ''
            }
          ],
          inspection: [
            {
              typeOfInspection: '',
              date: '',
              inspector: '',
              remarks: ''
            }
          ],
          permit: [
            {
              typeOfPermit: '',
              startDate: '',
              endDate: '',
              inspector: '',
              approver: '',
              remarks: ''
            }
          ],
          firstAidAccident: '',
          otherActivities: '',
          hsePhotoReferences: [
            {
              id: '',
              title: 'HSE Toolbox Meeting',
              entries: [
                {
                  id: '',
                  slots: [
                    {
                      id: '',
                      image: '',
                      caption: ''
                    },
                    {
                      id: '',
                      image: '',
                      caption: ''
                    }
                  ]
                }
              ]
            },
            {
              id: '',
              title: 'HSE Activity Photos',
              entries: [
                {
                  id: '',
                  slots: [
                    {
                      id: '',
                      image: '',
                      caption: ''
                    },
                    {
                      id: '',
                      image: '',
                      caption: ''
                    }
                  ]
                }
              ]
            }
          ]
        },
        resources: {
          manPower: {
            dateRange: 'Feb 20 - Feb 26',
            managementTeam: [
              {
                description: '',
                date: {
                  fri: 0,
                  sat: 0,
                  sun: 0,
                  mon: 0,
                  tue: 0,
                  wed: 0,
                  thu: 0
                },
                prevWeek: 0,
                thisWeek: 0,
                accumulated: 0
              }
            ],
            workingTeamInterior: [
              {
                description: '',
                date: {
                  fri: 0,
                  sat: 0,
                  sun: 0,
                  mon: 0,
                  tue: 0,
                  wed: 0,
                  thu: 0
                },
                prevWeek: 0,
                thisWeek: 0,
                accumulated: 0
              }
            ],
            workingTeamMEP: [
              {
                description: '',
                date: {
                  fri: 0,
                  sat: 0,
                  sun: 0,
                  mon: 0,
                  tue: 0,
                  wed: 0,
                  thu: 0
                },
                prevWeek: 0,
                thisWeek: 0,
                accumulated: 0
              }
            ]
          },
          material: [
            {
              description: '',
              unit: '',
              prevWeek: 0,
              thisWeek: 0,
              accumulated: 0
            }
          ],
          machinery: [
            {
              description: '',
              date: {
                fri: 0,
                sat: 0,
                sun: 0,
                mon: 0,
                tue: 0,
                wed: 0,
                thu: 0
              },
              prevWeek: 0,
              thisWeek: 0,
              accumulated: 0
            }
          ]
        },
        photos: {
          title: 'Site Activities Photos',
          locations: [
            {
              location: '',
              entries: [
                {
                  slots: [
                    {
                      image: '',
                      caption: ''
                    },
                    {
                      image: '',
                      caption: ''
                    }
                  ]
                }
              ]
            }
          ]
        },
        constructionIssues: [
          {
            no: '',
            location: '',
            problem: '',
            actionBy: '',
            photo: ''
          }
        ],
        masterSchedule: []
      }
    };

    return {
      success: true,
      data: template,
      message: 'Template generated successfully'
    };
  } catch (error) {
    console.error('Error getting template:', error);
    return {
      success: false,
      error: 'Failed to generate template',
      details: error.message
    };
  }
};

/**
 * Update a specific section of a weekly report
 */
const updateSection = async (reportId, userId, sectionName, updateData) => {
  try {
    // First check if report exists and belongs to user
    const existingReport = await WeeklyReport.findOne({ 
      _id: reportId, 
      userId 
    });

    if (!existingReport) {
      return {
        success: false,
        error: 'Weekly report not found or access denied'
      };
    }

    // Only allow updates on draft or in-progress reports
    if (existingReport.status !== 'draft' && existingReport.status !== 'in-progress') {
      return {
        success: false,
        error: 'Cannot update submitted, approved, or rejected reports'
      };
    }

    // Build the update object with the specific section
    const sectionUpdate = {};
    sectionUpdate[`sections.${sectionName}`] = updateData;

    const updatedReport = await WeeklyReport.findByIdAndUpdate(
      reportId,
      {
        $set: sectionUpdate,
        updatedAt: new Date(),
        version: (existingReport.version || 1) + 1
      },
      { new: true, runValidators: true }
    ).lean();

    return {
      success: true,
      data: updatedReport,
      message: `${sectionName} section updated successfully`
    };
  } catch (error) {
    console.error('Error updating section:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return {
        success: false,
        error: 'Validation failed',
        details: errors
      };
    }

    return {
      success: false,
      error: 'Failed to update section',
      details: error.message
    };
  }
};

/**
 * Handle bulk import of activities
 */
const bulkImportActivities = async (reportId, activitiesData) => {
  try {
    const report = await DailyReport.findById(reportId); // CHANGED: Use DailyReport model
    if (!report) {
      throw new Error('Report not found');
    }

    const { weeklyActivities, nextWeekPlan } = activitiesData;
    
    // Transform incoming activities to backend format
    const transformedWeekly = transformActivitiesToBackend(weeklyActivities || []);
    const transformedNext = transformActivitiesToBackend(nextWeekPlan || []);

    // Merge with existing activities
    const existingWeekly = report.activities?.weeklyActivities || [];
    const existingNext = report.activities?.nextWeekPlan || [];

    // Combine activities (avoid duplicates by description)
    const mergedWeekly = [...existingWeekly, ...transformedWeekly];
    const mergedNext = [...existingNext, ...transformedNext];

    // Update report
    if (!report.activities) {
      report.activities = {};
    }
    
    report.activities.weeklyActivities = mergedWeekly;
    report.activities.nextWeekPlan = mergedNext;
    report.updatedAt = new Date();

    await report.save();

    return {
      success: true,
      weeklyActivities: transformActivitiesToFrontend(mergedWeekly),
      nextWeekPlan: transformActivitiesToFrontend(mergedNext)
    };

  } catch (error) {
    console.error('Bulk import error:', error);
    throw new Error(`Bulk import failed: ${error.message}`);
  }
};

/**
 * Get activities by bulk import ID
 */
const getActivitiesByBulkImportId = async (userId, bulkImportId) => {
  try {
    const reports = await DailyReport.find({
      userId,
      'activities.weeklyActivities.bulkImportId': bulkImportId
    });

    const activities = [];
    reports.forEach(report => {
      const weeklyActivities = report.activities?.weeklyActivities?.filter(
        activity => activity.bulkImportId === bulkImportId
      ) || [];
      const nextWeekPlan = report.activities?.nextWeekPlan?.filter(
        activity => activity.bulkImportId === bulkImportId
      ) || [];
      
      activities.push(...transformActivitiesToFrontend(weeklyActivities));
      activities.push(...transformActivitiesToFrontend(nextWeekPlan));
    });

    return activities;
  } catch (error) {
    console.error('Get activities by bulk import ID error:', error);
    throw new Error(`Failed to get activities: ${error.message}`);
  }
};

/**
 * Get bulk import statistics
 */
const getBulkImportStats = async (userId) => {
  try {
    const reports = await DailyReport.find({ userId });
    
    let totalBulkImports = 0;
    let totalManualEntries = 0;
    const bulkImportBatches = new Set();

    reports.forEach(report => {
      const allWeeklyActivities = report.activities?.weeklyActivities || [];
      const allNextWeekPlan = report.activities?.nextWeekPlan || [];
      const allActivities = [...allWeeklyActivities, ...allNextWeekPlan];

      allActivities.forEach(activity => {
        if (activity.source === 'bulk') {
          totalBulkImports++;
          if (activity.bulkImportId) {
            bulkImportBatches.add(activity.bulkImportId);
          }
        } else {
          totalManualEntries++;
        }
      });
    });

    return {
      totalBulkImports,
      totalManualEntries,
      uniqueBulkImportBatches: bulkImportBatches.size,
      totalActivities: totalBulkImports + totalManualEntries
    };
  } catch (error) {
    console.error('Get bulk import stats error:', error);
    throw new Error(`Failed to get stats: ${error.message}`);
  }
};

/**
 * Aggregate manpower data for a weekly report
 * @param {string} projectName - Project name
 * @param {Date} startDate - Week start date (Friday)
 * @param {Date} endDate - Week end date (Thursday)
 * @param {Object} options - Options for aggregation (includePrevWeek, includeAccumulated, projectId)
 * @returns {Promise<Object>} - Aggregated manpower data
 */
const aggregateWeeklyManpower = async (projectName, startDate, endDate, options = {}) => {
  return await aggregateManpowerData(projectName, startDate, endDate, { ...options, projectId: options.projectId });
};
/**
 * Update weekly report with aggregated manpower data
 * @param {string} reportId - Weekly report ID
 * @param {Object} options - Options for aggregation
 * @returns {Promise<Object>} - Update result
 */
const updateReportManpower = async (reportId, options = {}) => {
  return await updateWeeklyReportManpower(reportId, options);
};

/**
 * Create weekly report with automatic manpower aggregation
 * @param {string} userId - User ID
 * @param {string} companyId - Company ID
 * @param {Object} reportData - Report data
 * @param {Object} aggregationOptions - Options for manpower aggregation
 * @returns {Promise<Object>} - Created report with aggregated manpower
 */
const createReportWithManpower = async (userId, companyId, reportData, aggregationOptions = {}) => {
  try {
    // Create the weekly report first
    const createResult = await createReport(userId, companyId, reportData);
    
    if (!createResult.success) {
      return createResult;
    }
    
    // Aggregate manpower data
    const manpowerResult = await updateWeeklyReportManpower(
      createResult.data._id,
      aggregationOptions
    );
    
    if (!manpowerResult.success) {
      console.warn('Manpower aggregation failed:', manpowerResult.error);
      // Still return the created report, but with a warning
      return {
        ...createResult,
        warning: 'Report created but manpower aggregation failed'
      };
    }
    
    return {
      success: true,
      data: manpowerResult.data,
      message: 'Weekly report created with manpower aggregation successfully'
    };
    
  } catch (error) {
    console.error('Error creating report with manpower:', error);
    return {
      success: false,
      error: 'Failed to create report with manpower aggregation',
      details: error.message
    };
  }
};

/**
 * Aggregate images from daily reports for a weekly report
 * @param {string} projectIdentifier - Project name or projectId
 * @param {Date} startDate - Week start date (Friday)
 * @param {Date} endDate - Week end date (Thursday)
 * @param {Object} options - Options for aggregation (useProjectId, maxImagesPerReport)
 * @returns {Promise<Object>} - Aggregated image data
 */
const aggregateWeeklyImages = async (projectIdentifier, startDate, endDate, options = {}) => {
  return await aggregateImages(projectIdentifier, startDate, endDate, options);
};

/**
 * Update weekly report with aggregated images from daily reports
 * @param {string} reportId - Weekly report ID
 * @param {Object} options - Options for aggregation (maxImagesPerReport)
 * @returns {Promise<Object>} - Update result
 */
const updateReportImages = async (reportId, options = {}) => {
  return await updateWeeklyReportImages(reportId, options);
};

/**
 * Create weekly report with automatic image aggregation
 * @param {string} userId - User ID
 * @param {string} companyId - Company ID
 * @param {Object} reportData - Report data
 * @param {Object} aggregationOptions - Options for image aggregation
 * @returns {Promise<Object>} - Created report with aggregated images
 */
const createReportWithImages = async (userId, companyId, reportData, aggregationOptions = {}) => {
  try {
    // Create the weekly report first
    const createResult = await createReport(userId, companyId, reportData);
    
    if (!createResult.success) {
      return createResult;
    }
    
    // Aggregate images from daily reports
    const imageResult = await updateWeeklyReportImages(
      createResult.data._id,
      aggregationOptions
    );
    
    if (!imageResult.success) {
      console.warn('Image aggregation failed:', imageResult.error);
      // Still return the created report, but with a warning
      return {
        ...createResult,
        warning: 'Report created but image aggregation failed'
      };
    }
    
    return {
      success: true,
      data: imageResult.data,
      message: 'Weekly report created with image aggregation successfully'
    };
    
  } catch (error) {
    console.error('Error creating report with images:', error);
    return {
      success: false,
      error: 'Failed to create report with image aggregation',
      details: error.message
    };
  }
};

/**
 * Get company-wide weekly reports (submitted only) with pagination and filtering
 * Similar to getCompanyReports in dailyReportService
 */
const getCompanyWeeklyReports = async (companyId, page = 1, limit = 20, search = "", projectFilter = "", projectIdFilter = "") => {
  try {
    const skip = (page - 1) * limit;
    
    // Build search query - only submitted reports for company view
    // Include reports with matching companyId OR reports without companyId (backward compatibility)
    let searchQuery = { 
      status: "submitted"
    };
    
    // Handle companyId matching - ONLY allow access to reports with matching companyId
    if (companyId) {
      // Convert to ObjectId if it's a string
      const companyIdObj = typeof companyId === 'string' ? new mongoose.Types.ObjectId(companyId) : companyId;
      
      searchQuery.companyId = companyIdObj;
    }

    // Add search filter
    if (search) {
      searchQuery = {
        $and: [
          searchQuery,
          {
            $or: [
              { projectName: { $regex: search, $options: "i" } },
              { "sections.activities.description": { $regex: search, $options: "i" } },
              { "userId.firstName": { $regex: search, $options: "i" } },
              { "userId.lastName": { $regex: search, $options: "i" } }
            ]
          }
        ]
      };
    }

    // Add project filter - prioritize projectId if available, fallback to projectName
    if (projectIdFilter) {
      // Use projectId for more reliable lookup (works even if project name changed)
      searchQuery = {
        $and: [
          searchQuery,
          { projectId: new mongoose.Types.ObjectId(projectIdFilter) }
        ]
      };
    } else if (projectFilter) {
      // Fallback to projectName for backward compatibility
      searchQuery = {
        $and: [
          searchQuery,
          { projectName: new RegExp(projectFilter, 'i') }
        ]
      };
    }

    const [reports, total] = await Promise.all([
      WeeklyReport.find(searchQuery)
        .sort({ startDate: -1, updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'firstName lastName email'),
      WeeklyReport.countDocuments(searchQuery)
    ]);
    
    return {
      success: true,
      data: reports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    };
  } catch (error) {
    console.error('Get company weekly reports error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// ============================================================================
// MASTER REPORT: Folder-level aggregation helpers (module-private)
// ============================================================================

/**
 * Sum thisWeek manpower values across all team arrays in a single report's resources.
 */
const _sumReportManpower = (report) => {
  const mp = report.sections?.resources?.manPower;
  if (!mp) return 0;
  const sumTeam = (arr) => (arr || []).reduce((s, row) => s + (Number(row.thisWeek) || 0), 0);
  return sumTeam(mp.managementTeam) + sumTeam(mp.workingTeamInterior) + sumTeam(mp.workingTeamMEP);
};

/**
 * Extract a single overall progress percentage from a report.
 * Priority: constructionProgress.items averages → overallProgress.rows → 0
 */
const _extractProjectProgress = (report) => {
  // Try constructionProgress items (most granular)
  const cpItems = report.sections?.constructionProgress?.items || [];
  if (cpItems.length > 0) {
    const values = cpItems
      .map(item => parseFloat(item.currentPercent ?? item.actualPercent ?? item.current ?? 0))
      .filter(v => !isNaN(v) && v > 0);
    if (values.length > 0) {
      return parseFloat((values.reduce((s, v) => s + v, 0) / values.length).toFixed(2));
    }
  }

  // Try overallProgress rows
  const opRows = report.sections?.overallProgress?.rows || [];
  if (opRows.length > 0) {
    const values = opRows
      .map(row => parseFloat(row.progress ?? row.percent ?? row.actual ?? 0))
      .filter(v => !isNaN(v) && v > 0);
    if (values.length > 0) {
      return parseFloat((values.reduce((s, v) => s + v, 0) / values.length).toFixed(2));
    }
  }

  return 0;
};

/**
 * Aggregate manpower totals across all reports.
 * Returns { managementTotal, workingInteriorTotal, workingMEPTotal, grandTotal,
 *           managementDates, workingInteriorDates, workingMEPDates }
 */
const _aggregateManpower = (reports) => {
  const sumTeam = (teamArr) => (teamArr || []).reduce((s, row) => s + (Number(row.thisWeek) || 0), 0);
  const emptyDays = () => ({ fri: 0, sat: 0, sun: 0, mon: 0, tue: 0, wed: 0, thu: 0 });
  const DAYS = ['fri', 'sat', 'sun', 'mon', 'tue', 'wed', 'thu'];

  const sumTeamDays = (teamArr) => {
    const result = emptyDays();
    (teamArr || []).forEach(row => {
      if (row.date) {
        DAYS.forEach(day => { result[day] += Number(row.date[day]) || 0; });
      }
    });
    return result;
  };

  let managementTotal = 0;
  let workingInteriorTotal = 0;
  let workingMEPTotal = 0;
  const managementDates = emptyDays();
  const workingInteriorDates = emptyDays();
  const workingMEPDates = emptyDays();

  reports.forEach(r => {
    const mp = r.sections?.resources?.manPower;
    if (!mp) return;
    managementTotal      += sumTeam(mp.managementTeam);
    workingInteriorTotal += sumTeam(mp.workingTeamInterior);
    workingMEPTotal      += sumTeam(mp.workingTeamMEP);
    const mgmtDays  = sumTeamDays(mp.managementTeam);
    const intDays   = sumTeamDays(mp.workingTeamInterior);
    const mepDays   = sumTeamDays(mp.workingTeamMEP);
    DAYS.forEach(day => {
      managementDates[day]      += mgmtDays[day];
      workingInteriorDates[day] += intDays[day];
      workingMEPDates[day]      += mepDays[day];
    });
  });

  return {
    managementTotal,
    workingInteriorTotal,
    workingMEPTotal,
    grandTotal: managementTotal + workingInteriorTotal + workingMEPTotal,
    managementDates,
    workingInteriorDates,
    workingMEPDates,
  };
};

/**
 * Weighted progress calculation across all reports.
 *
 * Formula:
 *   weightedProgress = Σ(progress_i × manpower_i) / Σ(manpower_i)
 *
 * If total manpower across all reports is 0 (no manpower data),
 * falls back to a simple arithmetic mean of non-zero progress values.
 *
 * Returns { weighted: number, perProject: { [projectId]: number } }
 */
const _aggregateProgress = (reports, projectMap) => {
  const perProject = {};
  let weightedSum  = 0;
  let totalWeight  = 0;
  let simpleSum    = 0;
  let validCount   = 0;

  reports.forEach(r => {
    const projectId = r.projectId?.toString();
    const progress  = _extractProjectProgress(r);
    perProject[projectId] = progress;

    if (progress > 0) {
      simpleSum += progress;
      validCount++;
    }

    const manpower = _sumReportManpower(r);
    if (progress > 0 && manpower > 0) {
      weightedSum += progress * manpower;
      totalWeight += manpower;
    }
  });

  const weighted = totalWeight > 0
    ? parseFloat((weightedSum / totalWeight).toFixed(2))
    : validCount > 0 ? parseFloat((simpleSum / validCount).toFixed(2)) : 0;

  return { weighted, perProject };
};

// ============================================================================
// MASTER REPORT: Main aggregation function
// ============================================================================

/**
 * Dynamically generate a folder-level Master Weekly Report.
 * No data is persisted – this is computed on-the-fly from existing WeeklyReport docs.
 *
 * @param {string} folderId  - MongoDB ObjectId of the Folder
 * @param {number} weekNumber - ISO week number (1-53)
 * @param {string} [companyId] - optional, for future access-control extension
 */
const getMasterReport = async (folderId, weekNumber, companyId) => {
  try {
    const Project = require('../models/projectModel');
    const Folder  = require('../models/folderModel');

    if (!mongoose.Types.ObjectId.isValid(folderId)) {
      return { success: false, error: 'Invalid folderId' };
    }

    // Step 1: Fetch folder metadata and all active projects in parallel
    const [folder, projects] = await Promise.all([
      Folder.findById(folderId).lean(),
      Project.find({ folderId: new mongoose.Types.ObjectId(folderId), isActive: true }).lean()
    ]);

    if (!folder) {
      return { success: false, error: 'Folder not found' };
    }

    if (!projects.length) {
      return {
        success: true,
        data: {
          type: 'master',
          folder,
          weekNumber,
          reports: [],
          aggregated: {
            activities: { weeklyActivities: [], nextWeekPlan: [] },
            manpower:   { managementTotal: 0, workingInteriorTotal: 0, workingMEPTotal: 0, grandTotal: 0 },
            photos:     {},
            progress:   { weighted: 0, perProject: {} },
            issues:     []
          }
        }
      };
    }

    const projectIds = projects.map(p => p._id);

    // Step 2: Single query – all weekly reports for those projects in the given week (no N+1)
    const reports = await WeeklyReport.find({
      projectId:  { $in: projectIds },
      weekNumber: parseInt(weekNumber)
    }).lean();

    // Build project lookup map for O(1) access
    const projectMap = Object.fromEntries(projects.map(p => [p._id.toString(), p]));

    // ── Step 3: Aggregation ──────────────────────────────────────────────────

    // ACTIVITIES: flatMap, preserving source project for display
    const allWeeklyActivities = reports.flatMap(r => {
      const pName = projectMap[r.projectId?.toString()]?.name || r.projectName;
      return (r.sections?.activities?.weeklyActivities || []).map(a => ({
        ...a,
        projectSource: pName
      }));
    });

    const allNextWeekPlan = reports.flatMap(r => {
      const pName = projectMap[r.projectId?.toString()]?.name || r.projectName;
      return (r.sections?.activities?.nextWeekPlan || []).map(a => ({
        ...a,
        projectSource: pName
      }));
    });

    // ISSUES: combine all arrays, tagged with source project
    const allIssues = reports.flatMap(r => {
      const pName = projectMap[r.projectId?.toString()]?.name || r.projectName;
      return (r.sections?.constructionIssues || []).map(issue => ({
        ...issue,
        projectSource: pName
      }));
    });

    // PHOTOS: group photo locations by project name
    const photosByProject = {};
    reports.forEach(r => {
      const pName    = projectMap[r.projectId?.toString()]?.name || r.projectName;
      const locations = r.sections?.photos?.locations || [];
      if (locations.length > 0) {
        photosByProject[pName] = locations;
      }
    });

    // MANPOWER: summed totals
    const aggregatedManpower = _aggregateManpower(reports);

    // PROGRESS: weighted by manpower, falls back to simple mean
    const aggregatedProgress = _aggregateProgress(reports, projectMap);

    // CONSTRUCTION PROGRESS: aggregate items from all reports with project source
    const constructionProgressByProject = {};
    reports.forEach(r => {
      const pName = projectMap[r.projectId?.toString()]?.name || r.projectName;
      const cpItems = r.sections?.constructionProgress?.items || [];
      if (cpItems.length > 0) {
        const projectInfo = r.sections?.constructionProgress?.projectInfo || { project: pName, subtitle: '' };
        const displayProjectName = projectInfo.project || pName;
        constructionProgressByProject[displayProjectName] = {
          projectInfo: projectInfo,
          items: cpItems.map(item => ({
            ...item,
            projectSource: displayProjectName
          }))
        };
      }
    });

    // QAQC: Aggregate items per section across all reports
    const qaqcSectionKeys = ['ncr', 'car', 'scar', 'pmsi', 'csi', 'ir', 'mfa', 'rfi', 'rfa', 'fcr', 'vo', 'tr', 'mir'];
    const aggregatedQaqcStatus = {};
    qaqcSectionKeys.forEach(key => {
      const allItems = [];
      const allCommentParts = [];

      reports.forEach(r => {
        const pName = projectMap[r.projectId?.toString()]?.name || r.projectName;
        const section = r.sections?.qaqcStatus?.[key];
        if (!section) return;
        if (section.comments?.trim()) {
          allCommentParts.push(`[${pName}] ${section.comments.trim()}`);
        }
        (section.items || []).forEach(item => {
          if (!item.code?.trim() && !item.description?.trim()) return;
          allItems.push({ ...item, projectSource: pName });
        });
      });

      // Sort chronologically by dateResponded
      allItems.sort((a, b) => {
        const dA = a.dateResponded ? new Date(a.dateResponded).getTime() : 0;
        const dB = b.dateResponded ? new Date(b.dateResponded).getTime() : 0;
        return dA - dB;
      });

      aggregatedQaqcStatus[key] = {
        items: allItems,
        comments: allCommentParts.join('\n\n---\n\n')
      };
    });

    // HSES: Aggregate training, inspection, permit, text fields, and photo references across all reports
    const hsesAcc = { training: [], inspection: [], permit: [], firstAidParts: [], otherParts: [] };
    
    // Initialize unified HSE photo sections with empty entries array
    const hsePhotoRefsAcc = {
      hseToolboxMeeting: [{
        id: 'unified-toolbox-meeting',
        title: 'HSE Toolbox Meeting',
        entries: []
      }],
      hseActivityPhotos: [{
        id: 'unified-activity-photos',
        title: 'HSE Activity Photos', 
        entries: []
      }]
    };

    // Helper function to add images with 2-per-entry limit
    const addImagesToSection = (section, imagesWithMetadata) => {
      const IMAGES_PER_ENTRY = 2;
      
      imagesWithMetadata.forEach((image) => {
        // Find the last entry or create a new one
        let currentEntry = section.entries[section.entries.length - 1];
        
        // If no entry exists or current entry is full, create new entry
        if (!currentEntry || currentEntry.slots.length >= IMAGES_PER_ENTRY) {
          const newEntry = {
            id: `entry-${section.entries.length + 1}`,
            slots: []
          };
          section.entries.push(newEntry);
          currentEntry = newEntry;
        }
        
        // Add image to current entry
        currentEntry.slots.push(image);
      });
    };

    reports.forEach((r) => {
      const pName = projectMap[r.projectId?.toString()]?.name || r.projectName;
      const hses = r.sections?.hses;

      if (!hses) return;
      
      // Aggregate HSE photo references - combine all images into unified sections
      const photoRefs = hses.hsePhotoReferences;
      if (photoRefs) {
        // Process toolbox meeting photos
        if (photoRefs.hseToolboxMeeting && Array.isArray(photoRefs.hseToolboxMeeting)) {
          photoRefs.hseToolboxMeeting.forEach((section) => {
            if (section.entries && Array.isArray(section.entries)) {
              section.entries.forEach((entry) => {
                if (entry.slots && Array.isArray(entry.slots)) {
                  const imagesWithMetadata = entry.slots
                    .filter(slot => slot.image && slot.image.trim() !== '')
                    .map(slot => ({
                      ...slot,
                      projectSource: pName
                    }));
                  
                  // Add images with 2-per-entry limit
                  addImagesToSection(hsePhotoRefsAcc.hseToolboxMeeting[0], imagesWithMetadata);
                }
              });
            }
          });
        }

        // Process activity photos
        if (photoRefs.hseActivityPhotos && Array.isArray(photoRefs.hseActivityPhotos)) {
          photoRefs.hseActivityPhotos.forEach((section) => {
            if (section.entries && Array.isArray(section.entries)) {
              section.entries.forEach((entry) => {
                if (entry.slots && Array.isArray(entry.slots)) {
                  const imagesWithMetadata = entry.slots
                    .filter(slot => slot.image && slot.image.trim() !== '')
                    .map(slot => ({
                      ...slot,
                      projectSource: pName
                    }));
                  
                  // Add images with 2-per-entry limit
                  addImagesToSection(hsePhotoRefsAcc.hseActivityPhotos[0], imagesWithMetadata);
                }
              });
            }
          });
        }
      }
      
      // Aggregate basic HSE data (existing logic)
      (hses.training || []).forEach(t => {
        if (t.typeOfTraining?.trim() || t.date?.trim()) hsesAcc.training.push({ ...t, projectSource: pName });
      });
      (hses.inspection || []).forEach(i => {
        if (i.typeOfInspection?.trim() || i.date?.trim()) hsesAcc.inspection.push({ ...i, projectSource: pName });
      });
      (hses.permit || []).forEach(p => {
        if (p.typeOfPermit?.trim() || p.startDate?.trim()) hsesAcc.permit.push({ ...p, projectSource: pName });
      });
      if (hses.firstAidAccident?.trim()) hsesAcc.firstAidParts.push(`[${pName}] ${hses.firstAidAccident.trim()}`);
      if (hses.otherActivities?.trim()) hsesAcc.otherParts.push(`[${pName}] ${hses.otherActivities.trim()}`);
    });
    

    const _sortByField = (arr, field) =>
      [...arr].sort((a, b) => new Date(a[field] || 0).getTime() - new Date(b[field] || 0).getTime());

    // Aggregate materials and machinery data across all reports
    const materialsAcc = [];
    const machineryAcc = [];
    
    console.log('🔍 Starting resource aggregation for', reports.length, 'reports');
    
    reports.forEach((r) => {
      const pName = projectMap[r.projectId?.toString()]?.name || r.projectName;
      
      // Aggregate materials
      if (r.sections?.resources?.material) {
        console.log('🔍 Found materials in report:', r.projectName, '- Count:', r.sections.resources.material.length);
        r.sections.resources.material.forEach((material) => {
          if (material.description || material.title || material.supplier || material.deliveryDate) {
            materialsAcc.push({
              ...material,
              title: material.title || material.description || 'Material',
              description: material.description || '',
              projectSource: pName
            });
            console.log('✅ Added material:', material.description || material.title || 'Unknown');
          }
        });
      }
      
      // Aggregate machinery
      if (r.sections?.resources?.machinery) {
        console.log('🔍 Found machinery in report:', r.projectName, '- Count:', r.sections.resources.machinery.length);
        r.sections.resources.machinery.forEach((equipment) => {
          if (equipment.description || equipment.type || equipment.quantity || equipment.condition) {
            machineryAcc.push({
              ...equipment,
              title: equipment.title || equipment.description || 'Machinery & Equipment',
              type: equipment.type || equipment.description || '',
              description: equipment.description || '',
              projectSource: pName
            });
            console.log('✅ Added machinery:', equipment.description || equipment.type || 'Unknown');
          }
        });
      }
    });
    
    console.log('📊 Resource aggregation complete:');
    console.log('  - Total materials:', materialsAcc.length);
    console.log('  - Total machinery:', machineryAcc.length);

    const aggregatedHses = {
      training:         _sortByField(hsesAcc.training, 'date'),
      inspection:       _sortByField(hsesAcc.inspection, 'date'),
      permit:           _sortByField(hsesAcc.permit, 'startDate'),
      firstAidAccident: hsesAcc.firstAidParts.join('\n\n'),
      otherActivities:  hsesAcc.otherParts.join('\n\n'),
      hsePhotoReferences: {
        hseToolboxMeeting: hsePhotoRefsAcc.hseToolboxMeeting,
        hseActivityPhotos: hsePhotoRefsAcc.hseActivityPhotos
      }
    };

    // Sort materials and machinery by date
    const _sortByDate = (arr) => [...arr].sort((a, b) => new Date(a.deliveryDate || a.date || 0).getTime() - new Date(b.deliveryDate || b.date || 0).getTime());

    // Lightweight per-project summary rows
    const projectSummaries = reports.map(r => {
      const project = projectMap[r.projectId?.toString()];
      
      // Check both locations for cover image (cover section OR introduction section)
      const coverImageFromCover = r.sections?.cover?.coverImage;
      const coverImageFromIntro = r.sections?.introduction?.coverImage;
      const actualCoverImage = coverImageFromCover || coverImageFromIntro || '';
      
      const summary = {
        reportId:      r._id?.toString(),
        projectId:     r.projectId,
        projectName:   project?.name || r.projectName,
        weekNumber:    r.weekNumber,
        status:        r.status,
        startDate:     r.startDate,
        endDate:       r.endDate,
        activityCount: (r.sections?.activities?.weeklyActivities || []).length,
        issueCount:    (r.sections?.constructionIssues || []).length,
        progress:      aggregatedProgress.perProject[r.projectId?.toString()] || 0,
        // Include timestamps for sorting
        createdAt:     r.createdAt,
        submittedAt:   r.submittedAt,
        // Include employer from cover section
        employer:      r.sections?.cover?.employer || '',
        // Include cover data for master report cover image selection
        cover:         {
          coverImage:  actualCoverImage,
          projectName: r.sections?.constructionProgress?.projectInfo?.project || project?.name || r.projectName,
          projectTitle: r.sections?.cover?.projectTitle || '',
          reportTitle: r.sections?.cover?.reportTitle || '',
          dateRange:   r.sections?.cover?.dateRange || '',
          employer:    r.sections?.cover?.employer || ''
        },
        // Include introduction data for master report intro section
        introduction:  {
          projectOverview: r.sections?.introduction?.projectOverview || '',
          designNConstruction: r.sections?.introduction?.designNConstruction || '',
          coverImage: r.sections?.introduction?.coverImage || ''
        },
        // Include letter data for master report letter section
        letter: {
          refNoPrefix: r.sections?.letter?.refNoPrefix || '',
          weekNumber: r.sections?.letter?.weekNumber || '',
          reportDate: r.sections?.letter?.reportDate || '',
          recipientCompany: r.sections?.letter?.recipientCompany || '',
          recipientLocation: r.sections?.letter?.recipientLocation || '',
          recipientName: r.sections?.letter?.recipientName || '',
          ccList: r.sections?.letter?.ccList || [],
          letterBody: r.sections?.letter?.letterBody || '',
          signatureImage: r.sections?.letter?.signatureImage || '',
          signatoryName: r.sections?.letter?.signatoryName || '',
          signatoryPosition: r.sections?.letter?.signatoryPosition || '',
          constructorName: r.sections?.letter?.constructorName || '',
          companyLocation: r.sections?.letter?.companyLocation || '',
          companyPhone1: r.sections?.letter?.companyPhone1 || '',
          companyPhone2: r.sections?.letter?.companyPhone2 || '',
          companyEmail1: r.sections?.letter?.companyEmail1 || '',
          companyEmail2: r.sections?.letter?.companyEmail2 || ''
        }
      };
      
      return summary;
    });
    
    // Collect all available cover images for frontend selection
    const availableCoverImages = projectSummaries
      .filter(p => p.cover?.coverImage && p.cover.coverImage !== '')
      .map(p => ({
        reportId: p.reportId,
        projectId: p.projectId,
        projectName: p.projectName,
        coverImage: p.cover.coverImage,
        status: p.status,
        submittedAt: p.submittedAt
      }));

    return {
      success: true,
      data: {
        type:      'master',
        folder,
        weekNumber: parseInt(weekNumber),
        reports:   projectSummaries,
        availableCoverImages,
        aggregated: {
          activities: { weeklyActivities: allWeeklyActivities, nextWeekPlan: allNextWeekPlan },
          manpower:   aggregatedManpower,
          photos:     photosByProject,
          progress:   aggregatedProgress,
          issues:              allIssues,
          constructionProgress: constructionProgressByProject,
          qaqcStatus:          aggregatedQaqcStatus,
          hses:                aggregatedHses,
          materials:            _sortByDate(materialsAcc),
          machinery:            _sortByDate(machineryAcc)
        }
      }
    };
  } catch (error) {
    console.error('Error generating master report:', error);
    return {
      success: false,
      error:   'Failed to generate master report',
      details: error.message
    };
  }
};

module.exports = {
  getAllReports,
  getReportById,
  createReport,
  updateReport,
  deleteReport,
  submitReport,
  approveReport,
  rejectReport,
  autoSaveReport,
  bulkImportActivities,
  getActivitiesByBulkImportId,
  getBulkImportStats,
  getTemplate,
  updateSection,
  // Company reports function
  getCompanyWeeklyReports,
  // Manpower aggregation functions
  aggregateWeeklyManpower,
  updateReportManpower,
  createReportWithManpower,
  // Image aggregation functions
  aggregateWeeklyImages,
  updateReportImages,
  createReportWithImages,
  // Master report (folder-level aggregation)
  getMasterReport,
  // Transformation utilities (exported for testing)
  transformActivitiesToBackend,
  transformActivitiesToFrontend,
  migrateLegacyActivities
};
