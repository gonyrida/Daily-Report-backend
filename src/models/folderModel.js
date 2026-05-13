const mongoose = require('mongoose');

const masterScheduleEntrySchema = new mongoose.Schema({
  id: { type: String },
  type: { type: String, enum: ['document', 'image', 'chart', 'pdf'] },
  title: { type: String },
  description: { type: String },
  date: { type: String },
  fileName: { type: String },
  supabaseUrl: { type: String },
  supabasePath: { type: String },
  fileSize: { type: Number },
  fileType: { type: String },
  caption: { type: String },
  convertedImages: [{ image: String, caption: String }]
}, { _id: false });

const folderSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Folder name is required'],
    trim: true,
    maxlength: [100, 'Folder name cannot exceed 100 characters']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Folder must have a creator']
  },
  createdByName: {
    type: String,
    required: true,
    trim: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: [true, 'Folder must belong to a company']
  },
  reportCount: {
    type: Number,
    default: 0,
    min: 0
  },
  lastReportDate: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  masterSchedule: {
    type: [masterScheduleEntrySchema],
    default: []
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
folderSchema.index({ companyId: 1, isActive: 1 });
folderSchema.index({ name: 1 });

const Folder = mongoose.model('Folder', folderSchema);

module.exports = Folder;
