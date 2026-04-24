const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const employeeSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    position: {
      type: String,
      required: true,
      trim: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
    },
    active: {
      type: Boolean,
      default: true,
    },
    mustChangePassword: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    passwordResetAt: {
      type: Date,
      default: null,
    },
    resetVersion: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compare password method
employeeSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Method to set new password
employeeSchema.methods.setPassword = async function (newPassword) {
  const salt = await bcrypt.genSalt(12);
  this.passwordHash = await bcrypt.hash(newPassword, salt);
  this.resetVersion = (this.resetVersion || 0) + 1;
  this.passwordResetAt = new Date();
  this.mustChangePassword = false;
};

// Method to update last login
employeeSchema.methods.updateLastLogin = function () {
  this.lastLogin = new Date();
  return this.save();
};

// Remove password from JSON output
employeeSchema.methods.toJSON = function () {
  const employeeObject = this.toObject();
  delete employeeObject.passwordHash;
  return employeeObject;
};

// Virtual for account status
employeeSchema.virtual("accountStatus").get(function () {
  return this.active ? "active" : "inactive";
});

// Ensure virtual fields are included in JSON
employeeSchema.set("toJSON", { virtuals: true });
employeeSchema.set("toObject", { virtuals: true });

// Indexes
employeeSchema.index({ email: 1 }, { unique: true });
employeeSchema.index({ department: 1 });
employeeSchema.index({ active: 1 });
employeeSchema.index({ createdAt: 1 });

const Employee = mongoose.model("Employee", employeeSchema);

module.exports = Employee;
