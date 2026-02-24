const mongoose = require("mongoose");

const purchaseRequestSchema = new mongoose.Schema(
  {
    // Requester Information
    requesterName: {
      type: String,
      required: [true, "Requester name is required"],
      trim: true,
    },
    requesterDepartment: {
      type: String,
      required: [true, "Requester department is required"],
      trim: true,
    },
    
    // Project Details
    projectName: {
      type: String,
      required: [true, "Project name is required"],
      trim: true,
    },
    purpose: {
      type: String,
      required: [true, "Purpose is required"],
      trim: true,
    },
    requestDate: {
      type: Date,
      required: [true, "Request date is required"],
    },
    deliveryPlace: {
      type: String,
      required: [true, "Delivery place is required"],
      trim: true,
    },
    
    // Categories
    categories: {
      construction: {
        type: Boolean,
        default: false,
      },
      admin: {
        type: Boolean,
        default: false,
      },
      material: {
        type: Boolean,
        default: false,
      },
      services: {
        type: Boolean,
        default: false,
      },
    },
    
    // Items Array
    items: [{
      description: {
        type: String,
        required: [true, "Item description is required"],
        trim: true,
      },
      unit: {
        type: String,
        required: [true, "Item unit is required"],
        trim: true,
      },
      quantity: {
        type: Number,
        required: [true, "Item quantity is required"],
        min: [1, "Quantity must be at least 1"],
      },
      unitPrice: {
        type: Number,
        required: [true, "Unit price is required"],
        min: [0, "Unit price must be non-negative"],
      },
      brand: {
        type: String,
        trim: true,
        default: null,
      },
      reference: {
        type: String,
        trim: true,
        default: null,
      },
      note: {
        type: String,
        trim: true,
        default: null,
      },
    }],
    
    // Calculated Fields
    grandTotal: {
      type: Number,
      required: false, // Remove required since middleware calculates it
      min: [0, "Grand total must be non-negative"],
      default: 0,
    },
    
    // Approval Workflow
    preparedBy: {
      type: String,
      trim: true,
      default: null,
    },
    checkedBy: {
      type: String,
      trim: true,
      default: null,
    },
    verifiedBy: {
      type: String,
      trim: true,
      default: null,
    },
    approvedBy: {
      type: String,
      trim: true,
      default: null,
    },
    
    // Status and Metadata
    status: {
      type: String,
      enum: ["pending", "checked", "verified", "approved", "rejected"],
      default: "pending",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    
    // Multi-tenant Support
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    
    // Soft Delete
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Helper function for number to words (basic implementation)
function numberToWords(num) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const thousands = ['', 'Thousand', 'Million', 'Billion'];
  
  if (num === 0) return 'Zero';
  if (num < 0) return 'Minus ' + numberToWords(Math.abs(num));
  
  let words = '';
  for (let i = 0; i < thousands.length; i++) {
    const divisor = Math.pow(1000, i);
    const quotient = Math.floor(num / divisor);
    
    if (quotient > 0 && quotient < 1000) {
      if (words !== '') words += ' ';
      words += convertChunk(quotient) + ' ' + thousands[i];
      num %= divisor;
    }
  }
  
  return words.trim();
}

function convertChunk(num) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  let str = '';
  if (num >= 100) {
    str += ones[Math.floor(num / 100)] + ' Hundred';
    num %= 100;
    if (num > 0) str += ' ';
  }
  
  if (num >= 20) {
    str += tens[Math.floor(num / 10)];
    num %= 10;
    if (num > 0) str += ' ' + ones[num];
  } else if (num >= 10) {
    str += teens[num - 10];
  } else if (num > 0) {
    str += ones[num];
  }
  
  return str.trim();
}

// Virtual for formatted grand total
purchaseRequestSchema.virtual("formattedGrandTotal").get(function () {
  return `$${this.grandTotal.toFixed(2)}`;
});

// Virtual for items count
purchaseRequestSchema.virtual("itemsCount").get(function () {
  return this.items.length;
});

// Virtual for amount in words (basic implementation)
purchaseRequestSchema.virtual("amountInWords").get(function () {
  const dollars = Math.floor(this.grandTotal);
  const cents = Math.round((this.grandTotal - dollars) * 100);
  
  let words = numberToWords(dollars);
  if (cents > 0) {
    words += ` and ${cents}/100`;
  }
  return `${words} Dollars`;
});

// Pre-save middleware to calculate grand total
purchaseRequestSchema.pre("save", async function () {
  // 'this' refers to the document being saved
  if (this.isModified("items")) {
    this.grandTotal = this.items.reduce((sum, item) => {
      const itemTotal = (item.quantity || 0) * (item.unitPrice || 0);
      return sum + itemTotal;
    }, 0);
    
    console.log("Calculated grandTotal:", this.grandTotal);
  }
  // No next() needed for async functions
});

// Indexes for performance
purchaseRequestSchema.index({ companyId: 1, createdAt: -1 });
purchaseRequestSchema.index({ createdBy: 1, createdAt: -1 });
purchaseRequestSchema.index({ status: 1 });
purchaseRequestSchema.index({ projectName: "text", purpose: "text" });

// Ensure virtual fields are included in JSON
purchaseRequestSchema.set("toJSON", { virtuals: true });
purchaseRequestSchema.set("toObject", { virtuals: true });

const PurchaseRequest = mongoose.model("PurchaseRequest", purchaseRequestSchema);

module.exports = PurchaseRequest;