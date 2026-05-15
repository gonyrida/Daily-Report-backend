
const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["material", "equipment"]
    },
    name:{
      type: String,
      required: [true, 'Item name is required'],
      unique: true,
      trim: true,
      default: '',
    },
    unit: {
      ref: 'Unit',
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Unit of measurement is required'],
    }
  }
)

itemSchema.index({ name: 1, type: 1 }, { unique: true });

const Item = mongoose.model('Item', itemSchema);

module.exports = Item;