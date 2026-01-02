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
      required: true,
    },

    workPlanNextDay: {
      type: String,
      default: "",
    },

    managementTeam: [ResourceSchema],
    workingTeam: [ResourceSchema],
    materials: [ResourceSchema],
    machinery: [ResourceSchema],

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

// Add index for faster queries
dailyReportSchema.index({ projectName: 1, reportDate: 1 });

const DailyReport = mongoose.model("DailyReport", dailyReportSchema);

module.exports = DailyReport;
