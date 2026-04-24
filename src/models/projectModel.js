const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Project name is required'],
    trim: true,
    maxlength: [100, 'Project name cannot exceed 100 characters']
  },
  folderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder',
    required: false, // Optional - projects can exist without a folder
    default: null
  },
  folderName: {
    type: String,
    default: '',
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Project must have a creator']
  },
  createdByName: {
    type: String,
    required: [true, 'Creator name is required'],
    trim: true
  },
  companyId: {  // ← ADD THIS FIELD
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: [true, 'Project must belong to a company']
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
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
  }
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for better query performance
projectSchema.index({ isActive: 1 });  
projectSchema.index({ name: 1 }); 
projectSchema.index({ companyId: 1, isActive: 1 });
projectSchema.index({ companyId: 1, name: 1 }); 
projectSchema.index({ folderId: 1, isActive: 1 }); 

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;