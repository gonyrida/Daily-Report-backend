const mongoose = require('mongoose');

const requestAuditLogSchema = new mongoose.Schema({
  // Reference to the purchase request
  requestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseRequest',
    required: true
  },

  // User who performed the action
  approver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Role of the approver
  role: {
    type: String,
    enum: ['prepared', 'checked', 'verified', 'approved', 'commented'],
    required: true
  },

  // Department of the approver (NEW FIELD)
  department: {
    type: String,
    required: true
  },

  // Status of the approval step
  status: {
    type: String,
    enum: ['pending', 'completed', 'skipped', 'rejected', 'approved', 'revised'],
    default: 'pending'
  },

  // When the action was performed
  timestamp: {
    type: Date,
    default: null
  },

  // Notes or comments
  notes: {
    type: String,
    default: null
  },

  // Additional metadata
  actionType: {
    type: String,
    enum: ['created', 'submitted', 'approved', 'rejected', 'modified', 'cancelled', 'commented', 'revised'],
    required: true
  },

  // Previous state (for audit purposes)
  previousState: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },

  // New state (for audit purposes)
  newState: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  collection: 'request_audit_logs'
});

// Indexes for better performance
requestAuditLogSchema.index({ requestId: 1, timestamp: -1 });
requestAuditLogSchema.index({ approver: 1, timestamp: -1 });
requestAuditLogSchema.index({ status: 1, timestamp: -1 });

module.exports = mongoose.model('RequestAuditLog', requestAuditLogSchema);