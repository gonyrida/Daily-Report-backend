const mongoose = require("mongoose");

// Image metadata schema for Supabase storage
const ImageMetadataSchema = new mongoose.Schema({
  supabaseUrl: { type: String, default: "" },
  supabasePath: { type: String, default: "" },
  fileName: { type: String, default: "" },
  fileSize: { type: Number, default: 0 },
  fileType: { type: String, default: "" },
  caption: { type: String, default: "" }
}, { _id: false });

// Use Mixed type for backward compatibility
const ImageArraySchema = {
  type: mongoose.Schema.Types.Mixed,
  default: []
};

const ResourceSchema = new mongoose.Schema(
  {
    description: { type: String, default: "" },
    unit: { type: String, default: "" },
    prev: { type: Number, default: 0 },
    today: { type: Number, default: 0 },
    accumulated: { type: Number, default: 0 },
    // REMOVED: name field (you already have description)
  },
  { _id: false }
);

const dailyReportSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: false, // ← IMPORTANT: Optional for existing reports
    },

    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: false, // Optional for backward compatibility
    },

    projectName: {
      type: String,
      required: true,
      trim: true,
    },

    folderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Folder',
      required: false,
    },

    folderName: {
      type: String,
      default: '',
      trim: true,
    },

    reportDate: {
      type: Date,
      required: true,
    },

    // New format: separate AM/PM weather and temperature
    weatherAM: {
      type: String,
      default: "",
    },
    weatherPM: {
      type: String,
      default: "",
    },
    tempAM: {
      type: String,
      default: "",
    },
    tempPM: {
      type: String,
      default: "",
    },
    location: {
      type: String,
      default: "",
      trim: true,
    },
    createdBy: {
      type: String,
      default: "",
      trim: true,
    },
    currentPeriod: {
      type: String,
      enum: ["AM", "PM"],
      default: "AM",
    },
    // Old format: backward compatibility (optional)
    weather: {
      type: String,
      required: false,
    },
    weatherPeriod: {
      type: String,
      enum: ["AM", "PM"],
      required: false,
    },
    temperature: {
      type: String,
      default: "",
    },

    activityToday: {
      type: String,
      required: false,
      default: "",
    },

    workPlanNextDay: {
      type: String,
      default: "",
    },

    firstSectionTitle: { type: String, default: "" },
    managementTeam: [ResourceSchema],
    secondSectionTitle: { type: String, default: "" },
    workingTeamInterior: [ResourceSchema],
    workingTeamMEP: [ResourceSchema],
    materials: [ResourceSchema],
    machinery: [ResourceSchema],

    // Backward compatibility for old data (optional)
    workingTeam: [ResourceSchema],
    interiorTeam: [ResourceSchema],
    mepTeam: [ResourceSchema],

    // New fields for combined reports
    logos: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    hse_title: {
      type: String,
      default: "",
    },

    hse: [{
      section_title: { type: String, default: "" },
      images: ImageArraySchema,
      footers: [{ type: String }]
    }],

    site_title: {
      type: String,
      default: "",
    },

    site_ref: [{
      section_title: { type: String, default: "" },
      images: ImageArraySchema,
      footers: [{ type: String }]
    }],

    // NEW: Add activities section for bulk import support
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

    description: {
      type: String,
      default: "",
    },

    photo_groups: [{
      images: ImageArraySchema,
      date: { type: String },
      footers: [{ type: String }]
    }],

    referenceSections: {
      type: mongoose.Schema.Types.Mixed, // or define a proper schema
      default: undefined,
    },

    tableTitle: {
      type: String,
      default: "SITE PHOTO EVIDENCE",
    },

    carSheet: {
      type: mongoose.Schema.Types.Mixed,
      default: {
        description: "",
        photo_groups: [{
          images: ImageArraySchema,
          date: String,
          footers: [String]
        }]
      },
    },

    projectLogo: {
      type: mongoose.Schema.Types.Mixed,
      default: ""
    },

    status: {
      type: String,
      enum: ["draft", "submitted"],
      default: "draft",
    },

    submittedAt: {
      type: Date,
      default: null,
    }, // ← ADD THIS

    lastUpdated: {
      type: Date,
      default: Date.now,
    },

    // Version for optimistic locking (concurrent edit protection)
    version: {
      type: Number,
      default: 0,
      min: 0
    },
  },
  {
    timestamps: true,
  },
  
);

// Add indexes for faster queries and auto-save functionality
dailyReportSchema.index({ projectId: 1, reportDate: -1 }); // Index by projectId for faster lookups
dailyReportSchema.index({ projectName: 1, reportDate: 1 });
dailyReportSchema.index({ userId: 1, updatedAt: -1 }); // For recent reports
dailyReportSchema.index({ userId: 1, status: 1, updatedAt: -1 }); // For drafts vs published
dailyReportSchema.index({ companyId: 1, reportDate: -1 });
dailyReportSchema.index({ userId: 1, projectName: 1, reportDate: 1, location: 1 }, { unique: true }); // Prevent duplicate reports per location
dailyReportSchema.index({ folderId: 1, reportDate: -1 }); // For folder queries
dailyReportSchema.index({ projectName: 1, folderName: 1, reportDate: -1 }); // For folder-based queries

const DailyReport = mongoose.model("DailyReport", dailyReportSchema);

module.exports = DailyReport;
