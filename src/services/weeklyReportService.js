const WeeklyReport = require('../models/WeeklyReport');
const DailyReport = require('../models/dailyReportModel'); // NEW: Import Daily Report model
const { aggregateManpowerData, updateWeeklyReportManpower } = require('../utils/manpowerAggregation');
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

    // Build query - remove userId filter to show all reports for project
    const query = {};
    
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

    const report = new WeeklyReport({
      projectName: reportData.projectName,
      projectId: reportData.projectId,  // ← add this
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

    // Save with validation bypassed for masterSchedule
    const savedReport = await report.save({ validateBeforeSave: false });

    // Force masterSchedule to be saved correctly
    if (sections.masterSchedule && sections.masterSchedule.length > 0) {
      savedReport.sections.masterSchedule = sections.masterSchedule;
      await savedReport.save({ validateBeforeSave: false });
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

    const updatedReport = await WeeklyReport.findByIdAndUpdate(
      reportId,
      updatedData,
      { new: true, runValidators: true }
    ).lean();

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
 * @param {Date} startDate - Week start date
 * @param {Date} endDate - Week end date
 * @param {Object} options - Options for aggregation
 * @returns {Promise<Object>} - Aggregated manpower data
 */
const aggregateWeeklyManpower = async (projectName, startDate, endDate, options = {}) => {
  return await aggregateManpowerData(projectName, startDate, endDate, options);
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
  // Transformation utilities (exported for testing)
  transformActivitiesToBackend,
  transformActivitiesToFrontend,
  migrateLegacyActivities
};
