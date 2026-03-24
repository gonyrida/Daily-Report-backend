const mongoose = require('mongoose');

const ProgressRowSchema = new mongoose.Schema({
  id: { type: String, required: true },
  description: { type: String, default: "" },
  unit: { type: Number, default: 0 },
  prev: { type: Number, default: 0 },
  today: { type: Number, default: 0 },
  accumulated: { type: Number, default: 0 },
  nextWeekPlan: { type: Number, default: 0 },
  upNextWeekPlan: { type: Number, default: 0 },
  rowType: { type: String, enum: ["title", "detail"], required: true },
  searchTerm: { type: String, default: "" },
  isCustomInput: { type: Boolean, default: false },
  displayIndex: { type: String, default: "" }
}, { _id: false });

const weeklyReportSchema = new mongoose.Schema({
  // Metadata
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  projectName: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  weekNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 53
  },
  startDate: {
    type: Date,
    required: true,
    index: true
  },
  endDate: {
    type: Date,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['draft', 'in-progress', 'submitted', 'approved', 'rejected'],
    default: 'draft',
    index: true
  },
  
  // Report sections
  sections: {
    cover: {
      projectName: { type: String, required: true },
      reportTitle: { type: String, required: true },
      weekNumber: String,
      dateRange: String,
      coverImage: String,
      projectTitle: String,
      employer: String,
      contractorName: { type: String, default: "Cambodian Advanced Construction Project Management (CACPM) Co., Ltd" }
    },
    
    letter: {
      refNoPrefix: { type: String, default: "" },
      weekNumber: { type: String, default: "" },
      reportDate: { type: String, default: "" },
      recipientCompany: { type: String, default: "" },
      recipientLocation: { type: String, default: "" },
      recipientName: { type: String, default: "" },
      ccList: { type: [String], default: [] },
      letterBody: { type: String, default: "" },
      signatureImage: { type: String, default: "" },
      signatoryName: { type: String, default: "" },
      signatoryPosition: { type: String, default: "" },
      constructorName: { type: String, default: "" },
      companyLocation: { type: String, default: "" },
      companyPhone1: { type: String, default: "" },
      companyPhone2: { type: String, default: "" },
      companyEmail1: { type: String, default: "" },
      companyEmail2: { type: String, default: "" }
    },
    
    introduction: {
      projectOverview: { type: String, default: "" },
      designNConstruction: { type: String, default: "" },
      coverImage: { type: String, default: "" }
    },
    
    overallProgress: {
      rows: [ProgressRowSchema]
    },
    
    activities: {
      weeklyActivities: [{
        description: String,
        percent: { type: Number, default: 0 }, // Changed from percentage: String to percent: Number
        source: { type: String, enum: ["manual", "bulk"], default: "manual" }, // NEW: Track how activity was added
        bulkImportId: String, // NEW: Track which bulk import batch this belongs to
        addedAt: { type: Date, default: Date.now }, // NEW: Track when activity was added
        // Legacy support for old nested structure
        percentage: String, // Keep for backward compatibility
        subActivities: [{
          description: String,
          percentage: String,
          subActivities: [{
            description: String,
            percentage: String,
            subActivities: [{
              description: String,
              percentage: String
            }]
          }]
        }]
      }],
      nextWeekPlan: [{
        description: String,
        percent: { type: Number, default: 0 }, // Changed from percentage: String to percent: Number
        source: { type: String, enum: ["manual", "bulk"], default: "manual" }, // NEW: Track how activity was added
        bulkImportId: String, // NEW: Track which bulk import batch this belongs to
        addedAt: { type: Date, default: Date.now }, // NEW: Track when activity was added
        // Legacy support for old nested structure
        percentage: String, // Keep for backward compatibility
        subActivities: [{
          description: String,
          percentage: String,
          subActivities: [{
            description: String,
            percentage: String,
            subActivities: [{
              description: String,
              percentage: String
            }]
          }]
        }]
      }]
    },
    
    qaqcStatus: {
      ncr: {
        items: [{
          code: String,
          description: String,
          status: String,
          dateResponded: String
        }],
        comments: String
      },
      car: {
        items: [{
          code: String,
          description: String,
          status: String,
          dateResponded: String
        }],
        comments: String
      },
      scar: {
        items: [{
          code: String,
          description: String,
          status: String,
          dateResponded: String
        }],
        comments: String
      },
      pmsi: {
        items: [{
          code: String,
          description: String,
          status: String,
          dateResponded: String
        }],
        comments: String
      },
      csi: {
        items: [{
          code: String,
          description: String,
          status: String,
          dateResponded: String
        }],
        comments: String
      },
      ir: {
        items: [{
          code: String,
          description: String,
          status: String,
          dateResponded: String
        }],
        comments: String
      },
      mfa: {
        items: [{
          code: String,
          description: String,
          status: String,
          dateResponded: String
        }],
        comments: String
      },
      rfi: {
        items: [{
          code: String,
          description: String,
          status: String,
          dateResponded: String
        }],
        comments: String
      },
      rfa: {
        items: [{
          code: String,
          description: String,
          status: String,
          dateResponded: String
        }],
        comments: String
      },
      fcr: {
        items: [{
          code: String,
          description: String,
          status: String,
          dateResponded: String
        }],
        comments: String
      },
      vo: {
        items: [{
          code: String,
          description: String,
          status: String,
          dateResponded: String
        }],
        comments: String
      },
      tr: {
        items: [{
          code: String,
          description: String,
          status: String,
          dateResponded: String
        }],
        comments: String
      }
    },
    
    hses: {
      training: [{
        typeOfTraining: String,
        date: String,
        venue: String,
        trainer: String,
        attendee: String,
        remarks: String
      }],
      inspection: [{
        typeOfInspection: String,
        date: String,
        inspector: String,
        remarks: String
      }],
      permit: [{
        typeOfPermit: String,
        startDate: String,
        endDate: String,
        inspector: String,
        approver: String,
        remarks: String
      }],
      firstAidAccident: String,
      otherActivities: String,
      hsePhotoReferences: [{
        id: String,
        title: String,
        entries: [{
          id: String,
          slots: [{
            id: String,
            image: String,
            caption: String
          }]
        }]
      }]
    },
    
    resources: {
      manPower: {
        dateRange: String,
        managementTeam: [{
          description: String,
          date: {
            fri: { type: Number, default: 0 },
            sat: { type: Number, default: 0 },
            sun: { type: Number, default: 0 },
            mon: { type: Number, default: 0 },
            tue: { type: Number, default: 0 },
            wed: { type: Number, default: 0 },
            thu: { type: Number, default: 0 }
          },
          prevWeek: { type: Number, default: 0 },
          thisWeek: { type: Number, default: 0 },
          accumulated: { type: Number, default: 0 }
        }],
        workingTeamInterior: [{
          description: String,
          date: {
            fri: { type: Number, default: 0 },
            sat: { type: Number, default: 0 },
            sun: { type: Number, default: 0 },
            mon: { type: Number, default: 0 },
            tue: { type: Number, default: 0 },
            wed: { type: Number, default: 0 },
            thu: { type: Number, default: 0 }
          },
          prevWeek: { type: Number, default: 0 },
          thisWeek: { type: Number, default: 0 },
          accumulated: { type: Number, default: 0 }
        }],
        workingTeamMEP: [{
          description: String,
          date: {
            fri: { type: Number, default: 0 },
            sat: { type: Number, default: 0 },
            sun: { type: Number, default: 0 },
            mon: { type: Number, default: 0 },
            tue: { type: Number, default: 0 },
            wed: { type: Number, default: 0 },
            thu: { type: Number, default: 0 }
          },
          prevWeek: { type: Number, default: 0 },
          thisWeek: { type: Number, default: 0 },
          accumulated: { type: Number, default: 0 }
        }]
      },
      material: [{
        description: String,
        unit: String,
        prevWeek: { type: Number, default: 0 },
        thisWeek: { type: Number, default: 0 },
        accumulated: { type: Number, default: 0 }
      }],
      machinery: [{
        description: String,
        date: {
          fri: { type: Number, default: 0 },
          sat: { type: Number, default: 0 },
          sun: { type: Number, default: 0 },
          mon: { type: Number, default: 0 },
          tue: { type: Number, default: 0 },
          wed: { type: Number, default: 0 },
          thu: { type: Number, default: 0 }
        },
        prevWeek: { type: Number, default: 0 },
        thisWeek: { type: Number, default: 0 },
        accumulated: { type: Number, default: 0 }
      }]
    },
    
    photos: {
      title: { type: String, default: "Site Activities Photos" },
      locations: [{
        location: String,
        entries: [{
          slots: [{
            image: String,
            caption: String
          }]
        }]
      }]
    },
    
    constructionIssues: [{
      no: String,
      location: String,
      problem: String,
      actionBy: String,
      photo: String
    }],
    
    masterSchedule: [{
      id: { type: String, required: true },
      type: { type: String, required: true },
      title: { type: String, required: true },
      description: { type: String, default: "" },
      date: { type: String, required: true },
      fileName: { type: String, default: "" }, // Optional - can be empty for entries without files
      fileData: { type: String, default: "" }, // Base64 encoded file data, optional
      supabaseUrl: { type: String, default: "" }, // Supabase public URL
      supabasePath: { type: String, default: "" }, // Supabase storage path
      fileSize: { type: Number, default: 0 }, // File size in bytes
      fileType: { type: String, default: "" }, // MIME type
      caption: { type: String, default: "" } // File caption
    }], // Array without default to prevent override
    
    constructionProgress: {
      projectInfo: {
        project: { type: String, default: "" },
        subtitle: { type: String, default: "" },
        date: { type: String, default: "" },
        revision: { type: String, default: "" }
      },
      items: [{
        id: { type: String },
        isBold: { type: Boolean, default: false },
        scopeOfWorks: { type: String, default: "" },
        detailDescription: { type: String, default: "" },
        unit: { type: String, default: "" },
        boQ: {
          qty: { type: Number, default: 0 },
          materialRate: { type: Number, default: 0 },
          laborRate: { type: Number, default: 0 },
          unitRate: { type: Number, default: 0 },
          amount: { type: Number, default: 0 }
        },
        remark: { type: String, default: "" },
        previousWeek: {
          qty: { type: Number, default: 0 },
          amount: { type: Number, default: 0 },
          percentage: { type: Number, default: 0 }
        },
        thisWeek: {
          qty: { type: Number, default: 0 },
          amount: { type: Number, default: 0 },
          percentage: { type: Number, default: 0 }
        },
        upToThisWeek: {
          qty: { type: Number, default: 0 },
          amount: { type: Number, default: 0 },
          percentage: { type: Number, default: 0 }
        },
        remaining: {
          qty: { type: Number, default: 0 },
          amount: { type: Number, default: 0 },
          percentage: { type: Number, default: 0 }
        },
        nextWeekPlan: {
          qty: { type: Number, default: 0 },
          amount: { type: Number, default: 0 },
          percentage: { type: Number, default: 0 }
        },
        upToNextWeekPlan: {
          qty: { type: Number, default: 0 },
          amount: { type: Number, default: 0 },
          percentage: { type: Number, default: 0 }
        }
      }]
    }
  },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now, index: true },
  submittedAt: Date,
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Version for optimistic locking
  version: { type: Number, default: 1, min: 1 }
}, {
  timestamps: true,
  // Add compound indexes for performance
  index: { userId: 1, projectName: 1, weekNumber: 1 },
  index: { userId: 1, startDate: 1, endDate: 1 },
  index: { userId: 1, status: 1, createdAt: -1 }
});

// Static method to find user's weekly reports
weeklyReportSchema.statics.findByUserId = function(userId, options = {}) {
  const query = this.find({ userId });
  
  if (options.status) {
    query.where({ status: options.status });
  }
  
  if (options.projectName) {
    query.where({ projectName: new RegExp(options.projectName, 'i') });
  }
  
  if (options.dateRange) {
    query.where({
      startDate: { $gte: options.dateRange.start },
      endDate: { $lte: options.dateRange.end }
    });
  }
  
  return query
    .sort({ createdAt: -1 })
    .skip(options.skip || 0)
    .limit(options.limit || 10);
};

// Instance method to update status with audit trail
weeklyReportSchema.methods.updateStatus = function(newStatus, userId) {
  this.status = newStatus;
  this.updatedAt = new Date();
  
  if (newStatus === 'submitted') {
    this.submittedAt = new Date();
    this.submittedBy = userId;
  } else if (newStatus === 'approved') {
    this.approvedAt = new Date();
    this.approvedBy = userId;
  }
  
  return this.save();
};

module.exports = mongoose.model('WeeklyReport', weeklyReportSchema);
