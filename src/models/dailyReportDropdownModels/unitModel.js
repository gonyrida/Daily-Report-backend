const mongoose = require("mongoose");

const unitSchema = new mongoose.Schema(
  {
    name:{
      type: String,
      required: [true, 'Unit name is required'],
      trim: true,
      default: '',
    },
    normalizedLabel: { 
      type: String, 
      required: true, 
      unique: true, 
      lowercase: true, 
      trim: true 
    },
  }
)

unitSchema.index({ normalizedLabel: 1 });

const Unit = mongoose.model('Unit', unitSchema);

module.exports = Unit;