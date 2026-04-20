const mongoose = require('mongoose');

const tokenBlacklistSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 } // Auto-delete expired documents
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient queries (token already has unique index)
tokenBlacklistSchema.index({ userId: 1 });

module.exports = mongoose.model('TokenBlacklist', tokenBlacklistSchema);
