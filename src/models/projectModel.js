const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Project name is required'],
    trim: true,
    maxlength: [100, 'Project name cannot exceed 100 characters']
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
projectSchema.index({ isActive: 1 });  // ← Remove createdBy from index since we're not filtering by it
projectSchema.index({ name: 1 }, { unique: true });

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;