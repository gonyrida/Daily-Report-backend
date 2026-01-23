const mongoose = require("mongoose");

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

    projectName: {
      type: String,
      required: true,
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

    managementTeam: [ResourceSchema],
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
      images: [{ type: String }],
      footers: [{ type: String }]
    }],

    site_title: {
      type: String,
      default: "",
    },

    site_ref: [{
      section_title: { type: String, default: "" },
      images: [{ type: String }],
      footers: [{ type: String }]
    }],

    description: {
      type: String,
      default: "",
    },

    photo_groups: [{
      images: [{ type: String }],
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
        photo_groups: []
      },
    },

    projectLogo: {
      type: String,  // Store base64 or URL
      default: "",
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
  },
  {
    timestamps: true,
  }
);

// Add indexes for faster queries and auto-save functionality
dailyReportSchema.index({ projectName: 1, reportDate: 1 });
dailyReportSchema.index({ userId: 1, updatedAt: -1 }); // For recent reports
dailyReportSchema.index({ userId: 1, status: 1, updatedAt: -1 }); // For drafts vs published

const DailyReport = mongoose.model("DailyReport", dailyReportSchema);

module.exports = DailyReport;
