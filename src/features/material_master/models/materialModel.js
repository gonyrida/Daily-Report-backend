// File: Daily-Report-backend/src/models/materialModel.js
// Material Item Model for MongoDB

const mongoose = require('mongoose');

const materialSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Material code is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Material code must be at least 3 characters'],
      maxlength: [20, 'Material code cannot exceed 20 characters'],
      match: [/^[A-Z0-9\-_]+$/, 'Material code can only contain uppercase letters, numbers, hyphens, and underscores']
    },
    description: {
      type: String,
      required: [true, 'Material description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters'],
      maxlength: [500, 'Description cannot exceed 500 characters']
    },
    reference: {
      type: String,
      maxlength: [500, 'Reference cannot exceed 500 characters'],
      default: '#file:placeholder.png'
    },
    unit: {
      type: String,
      required: [true, 'Unit of measurement is required'],
      enum: {
        values: ['pcs', 'kg', 'meter', 'liter', 'box', 'pack'],
        message: '{VALUE} is not a valid unit. Allowed: pcs, kg, meter, liter, box, pack'
      }
    },
    unitPrice: {
      type: mongoose.Schema.Types.Decimal128,
      required: [true, 'Unit price is required'],
      get: function(value) {
        if (value !== null && value !== undefined) {
          return parseFloat(value.toString());
        }
        return 0;
      },
      validate: {
        validator: function(value) {
          return parseFloat(value.toString()) >= 0;
        },
        message: 'Unit price must be a positive number'
      }
    },
    brand: {
      type: String,
      required: [true, 'Brand name is required'],
      trim: true,
      maxlength: [100, 'Brand name cannot exceed 100 characters']
    },
    // quantity: {
    //   type: Number,
    //   default: 0,
    //   validate: {
    //     validator: function(value) {
    //       return value >= 0;
    //     },
    //     message: 'Quantity cannot be negative'
    //   }
    // },
    status: {
      type: String,
      enum: {
        values: ['active', 'inactive'],
        message: 'Status must be either "active" or "inactive"'
      },
      default: 'active'
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    metadata: {
      lastChecked: Date,
      stockWarningLevel: {
        type: Number,
        default: 10
      },
      supplierInfo: {
        name: String,
        contactPerson: String,
        phone: String,
        email: String
      }
    }
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true }
  }
);

// Indexes for better query performance
materialSchema.index({ code: 1 }, { unique: true });
materialSchema.index({ brand: 1 });
materialSchema.index({ status: 1 });
materialSchema.index({ unit: 1 });
materialSchema.index({ createdAt: -1 });
materialSchema.index({ updatedAt: -1 });
materialSchema.index({ createdBy: 1 });

// Virtual for formatted price
materialSchema.virtual('formattedPrice').get(function() {
  const price = this.unitPrice ? parseFloat(this.unitPrice.toString()) : 0;
  return `$${price.toFixed(2)}`;
});

// Virtual for inventory value
materialSchema.virtual('inventoryValue').get(function() {
  const price = this.unitPrice ? parseFloat(this.unitPrice.toString()) : 0;
  const qty = this.quantity || 0;
  return price * qty;
});

// Middleware to validate before saving
materialSchema.pre('save', async function(next) {
  // Check for duplicate code (if code is being updated)
  if (this.isModified('code')) {
    const existingMaterial = await mongoose.model('Material').findOne({
      code: this.code,
      _id: { $ne: this._id }
    });
    if (existingMaterial) {
      throw new Error(`Material with code ${this.code} already exists`);
    }
  }
});

// Middleware to populate user references
materialSchema.pre('findOne', function() {
  this.populate('createdBy', 'name email');
  this.populate('lastModifiedBy', 'name email');
});

materialSchema.pre('find', function() {
  this.populate('createdBy', 'name email');
  this.populate('lastModifiedBy', 'name email');
});

// Instance methods
materialSchema.methods.toJSON = function() {
  const material = this.toObject();
  material.unitPrice = this.unitPrice ? parseFloat(this.unitPrice.toString()) : 0;
  delete material.__v;
  return material;
};

materialSchema.methods.updateStock = async function(quantity) {
  this.quantity = quantity;
  this.lastModifiedBy = mongoose.Types.ObjectId.isValid(this.lastModifiedBy)
    ? this.lastModifiedBy
    : new mongoose.Types.ObjectId();
  return this.save();
};

materialSchema.methods.isLowStock = function(warningLevel) {
  return this.quantity <= (warningLevel || this.metadata?.stockWarningLevel || 10);
};

// Static methods
materialSchema.statics.findByCode = function(code) {
  return this.findOne({ code });
};

materialSchema.statics.findByBrand = function(brand) {
  return this.find({ brand });
};

materialSchema.statics.findActive = function() {
  return this.find({ status: 'active' });
};

materialSchema.statics.getTotalValue = async function() {
  const materials = await this.find();
  return materials.reduce((total, material) => {
    const price = material.unitPrice ? parseFloat(material.unitPrice.toString()) : 0;
    const qty = material.quantity || 0;
    return total + (price * qty);
  }, 0);
};

materialSchema.statics.getLowStockItems = async function(warningLevel = 10) {
  return this.find({ quantity: { $lte: warningLevel } });
};

// Create model
const Material = mongoose.model('Material', materialSchema);

module.exports = Material;
