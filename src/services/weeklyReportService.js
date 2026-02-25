const WeeklyReport = require('../models/WeeklyReport');

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
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    const skip = (page - 1) * limit;
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Build query
    const query = { userId };
    
    if (status) {
      query.status = status;
    }
    
    if (projectName) {
      query.projectName = new RegExp(projectName, 'i');
    }
    
    if (startDate || endDate) {
      query.startDate = {};
      if (startDate) {
        query.startDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.startDate.$lte = new Date(endDate);
      }
    }

    const reports = await WeeklyReport.find(query)
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
const getReportById = async (reportId, userId) => {
  try {
    const report = await WeeklyReport.findOne({ _id: reportId, userId })
      .lean();

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
    console.error('Error getting weekly report:', error);
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
const createReport = async (userId, reportData) => {
  try {
    // Ensure sections object exists and has introduction with proper defaults
    const sections = {
      ...reportData.sections,
      introduction: {
        projectOverview: reportData.sections?.introduction?.projectOverview || "",
        designNConstruction: reportData.sections?.introduction?.designNConstruction || "",
        coverImage: reportData.sections?.introduction?.coverImage || ""
      }
    };

    const report = new WeeklyReport({
      ...reportData,
      sections,
      userId,
      status: 'draft',
      version: 1
    });

    const savedReport = await report.save();

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
    const updatedData = {
      ...existingReport.toObject(),
      ...updateData,
      updatedAt: new Date(),
      version: (existingReport.version || 1) + 1
    };

    // Ensure introduction section exists with proper defaults
    if (updatedData.sections) {
      updatedData.sections.introduction = {
        projectOverview: updatedData.sections.introduction?.projectOverview || "",
        designNConstruction: updatedData.sections.introduction?.designNConstruction || "",
        coverImage: updatedData.sections.introduction?.coverImage || ""
      };
    }

    const updatedReport = await WeeklyReport.findByIdAndUpdate(
      reportId,
      updatedData,
      { new: true, runValidators: true }
    ).lean();

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

    if (report.status !== 'draft' && report.status !== 'in-progress') {
      return {
        success: false,
        error: 'Only draft or in-progress reports can be submitted'
      };
    }

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
const getTemplate = async (projectName) => {
  try {
    const template = {
      projectName,
      weekNumber: 1,
      startDate: new Date(),
      endDate: new Date(),
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
        activities: {
          weeklyActivities: [
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
          }
        },
        hses: {
          training: [
            {
              description: '',
              date: '',
              venue: '',
              attendee: '',
              remark: ''
            }
          ],
          inspection: [
            {
              description: '',
              date: '',
              inspector: '',
              remark: ''
            }
          ],
          permit: [
            {
              description: '',
              startDate: '',
              endDate: '',
              inspector: '',
              approver: '',
              remark: ''
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
                  fri: '',
                  sat: '',
                  sun: '',
                  mon: '',
                  tue: '',
                  wed: '',
                  thu: ''
                },
                prevWeek: '',
                thisWeek: '',
                accumulated: ''
              }
            ],
            workingTeamInterior: [
              {
                description: '',
                date: {
                  fri: '',
                  sat: '',
                  sun: '',
                  mon: '',
                  tue: '',
                  wed: '',
                  thu: ''
                },
                prevWeek: '',
                thisWeek: '',
                accumulated: ''
              }
            ],
            workingTeamMEP: [
              {
                description: '',
                date: {
                  fri: '',
                  sat: '',
                  sun: '',
                  mon: '',
                  tue: '',
                  wed: '',
                  thu: ''
                },
                prevWeek: '',
                thisWeek: '',
                accumulated: ''
              }
            ]
          },
          material: [
            {
              description: '',
              unit: '',
              prevWeek: '',
              thisWeek: '',
              accumulated: ''
            }
          ],
          machinery: [
            {
              description: '',
              date: {
                fri: '',
                sat: '',
                sun: '',
                mon: '',
                tue: '',
                wed: '',
                thu: ''
              },
              prevWeek: '',
              thisWeek: '',
              accumulated: ''
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
        ]
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
    console.log(`🔧 DEBUG updateSection: sectionName=${sectionName}, reportId=${reportId}`);
    console.log(`🔧 DEBUG updateSection: updateData=`, JSON.stringify(updateData, null, 2));
    
    // First check if report exists and belongs to user
    const existingReport = await WeeklyReport.findOne({ 
      _id: reportId, 
      userId 
    });

    if (!existingReport) {
      console.log(`❌ DEBUG updateSection: Report not found for reportId=${reportId}, userId=${userId}`);
      return {
        success: false,
        error: 'Weekly report not found or access denied'
      };
    }

    // Only allow updates on draft or in-progress reports
    if (existingReport.status !== 'draft' && existingReport.status !== 'in-progress') {
      console.log(`❌ DEBUG updateSection: Cannot update report with status=${existingReport.status}`);
      return {
        success: false,
        error: 'Cannot update submitted, approved, or rejected reports'
      };
    }

    // Build the update object with the specific section
    const sectionUpdate = {};
    sectionUpdate[`sections.${sectionName}`] = updateData;
    
    console.log(`🔧 DEBUG updateSection: sectionUpdate=`, JSON.stringify(sectionUpdate, null, 2));

    const updatedReport = await WeeklyReport.findByIdAndUpdate(
      reportId,
      {
        $set: sectionUpdate,
        updatedAt: new Date(),
        version: (existingReport.version || 1) + 1
      },
      { new: true, runValidators: true }
    ).lean();

    console.log(`✅ DEBUG updateSection: Successfully updated ${sectionName} section`);
    console.log(`🔧 DEBUG updateSection: Updated data=`, JSON.stringify(updatedReport.sections[sectionName], null, 2));

    return {
      success: true,
      data: updatedReport,
      message: `${sectionName} section updated successfully`
    };
  } catch (error) {
    console.error('❌ Error updating section:', error);
    console.error('❌ Error details:', error.message);
    
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
  getTemplate,
  updateSection
};
