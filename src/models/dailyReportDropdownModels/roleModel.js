const mongoose = require("mongoose");

const roleSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["management", "working"],
      required: [true, 'Role type is required'],
    },
    name:{
      type: String,
      required: [true, 'Role name is required'],
      unique: true,
      trim: true,
      default: '',
    }
  }
)

roleSchema.index({ name: 1}, { unique: true });

const Role = mongoose.model('Role', roleSchema);

module.exports = Role;