const mongoose = require("mongoose");

const passwordResetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    used: {
      type: Boolean,
      default: false,
    },
    ipAddress: {
      type: String,
      required: false,
    },
    userAgent: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// TTL index to automatically delete expired reset tokens
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for faster queries
passwordResetSchema.index({ token: 1 });

// Index for user-based queries and cleanup
passwordResetSchema.index({ userId: 1, used: 1 });

// Index for monitoring suspicious activity
passwordResetSchema.index({ ipAddress: 1, createdAt: 1 });

const PasswordReset = mongoose.model("PasswordReset", passwordResetSchema);

module.exports = PasswordReset;
