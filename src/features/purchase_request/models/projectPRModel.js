// Daily-Report-backend\src\features\purchase_request\models\projectPRModal.js
const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
  // --- IDENTIFICATION ---
  name: { type: String, required: true, trim: true },
  projectCode: { type: String, required: true, unique: true }, 
  description: { type: String, trim: true },
  status: { type: String, default: 'active', enum: ['active', 'on_hold', 'completed'] },
  requestDate: { type: Date, default: Date.now },
  visibility: { type: String, default: 'private', enum: ['public', 'private'] },
  counter: { // Counter number for tracking request
    type: Number,
    default: 0, // Start with counter 0
    min: 0, // Minimum counter is 0
    required: true
  },
  
  // --- SUB-PROJECTS ---
  subProjects: [{
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    name: { type: String, required: true },
  }],
  
  // --- BUDGET SETTINGS ---
  budgetSettings: {
    MBOQ: { type: Number, required: true, default: 0 },
    DMBOQ: { type: Number, required: true, default: 0 },
    percentage: { type: Number, required: true, default: 0 }
  },
  
  // --- PURPOSES ---
  purposes: [{
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    name: { type: String, required: true },
    MBOQBudget: { type: Number, default: 0 },
    DMBOQBudget: { type: Number, default: 0 }
  }],
  
  // --- MEMBERS ---
  members: [{
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    department: { type: String, required: true },
    role: { type: String, required: true },
    position: { type: String, required: true },
  }],
  
  // --- METADATA ---
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  companyId: { type: mongoose.Schema.Types.ObjectId, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
},{
  collection: 'pr_projects'
});

// Add indexes for better performance
ProjectSchema.index({ projectCode: 1 });
ProjectSchema.index({ companyId: 1 });
ProjectSchema.index({ createdBy: 1 });
ProjectSchema.index({ status: 1 });

module.exports = mongoose.model('PR_Project', ProjectSchema);