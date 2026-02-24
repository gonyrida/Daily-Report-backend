// src/features/purchase_request/controllers/purchaseRequestController.js
const PurchaseRequest = require("../models/purchaseRequestModel");
const User = require("../../../models/userModel");

// @desc    Create new purchase request
// @route   POST /api/purchase-requests
// @access  Private (all authenticated users)
exports.createPurchaseRequest = async (req, res) => {
  try {
    const {
      requesterName,
      requesterDepartment,
      projectName,
      purpose,
      requestDate,
      deliveryPlace,
      categories,
      items,
      preparedBy,
      checkedBy,
      verifiedBy,
      approvedBy,
      priority
    } = req.body;

    // Validation
    if (!requesterName || !requesterDepartment || !projectName || !purpose || !requestDate || !deliveryPlace) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided"
      });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one item must be added to the purchase request"
      });
    }

    // Validate each item
    for (const item of items) {
      if (!item.description || !item.unit || !item.quantity || !item.unitPrice) {
        return res.status(400).json({
          success: false,
          message: "All item fields (description, unit, quantity, unitPrice) are required"
        });
      }

      if (item.quantity <= 0 || item.unitPrice < 0) {
        return res.status(400).json({
          success: false,
          message: "Item quantity must be positive and unit price must be non-negative"
        });
      }
    }

    // Get user information for multi-tenant support
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Create purchase request
    const purchaseRequest = new PurchaseRequest({
      requesterName,
      requesterDepartment,
      projectName,
      purpose,
      requestDate,
      deliveryPlace,
      categories: categories || {
        construction: false,
        admin: false,
        material: false,
        services: false
      },
      items,
      preparedBy: preparedBy || null,
      checkedBy: checkedBy || null,
      verifiedBy: verifiedBy || null,
      approvedBy: approvedBy || null,
      priority: priority || 'medium',
      companyId: user.companyId,
      createdBy: user._id
    });

    // Grand total will be calculated automatically by pre-save middleware
    await purchaseRequest.save();

    // Populate user details for response
    await purchaseRequest.populate('createdBy', 'firstName lastName email');

    res.status(201).json({
      success: true,
      message: "Purchase request created successfully",
      data: purchaseRequest
    });

  } catch (error) {
    console.error("Create purchase request error:", error);
    res.status(500).json({
      success: false,
      message: "Server error creating purchase request",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get all purchase requests for a user
// @route   GET /api/purchase-requests
// @access  Private
exports.getPurchaseRequests = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const { page = 1, limit = 10, status, search } = req.query;
    const skip = (page - 1) * limit;

    // Build query
    let query = {
      companyId: user.companyId,
      isDeleted: false
    };

    // Filter by status if provided
    if (status) {
      query.status = status;
    }

    // Search functionality
    if (search) {
      query.$or = [
        { projectName: { $regex: search, $options: 'i' } },
        { purpose: { $regex: search, $options: 'i' } },
        { requesterName: { $regex: search, $options: 'i' } }
      ];
    }

    // Get purchase requests
    const purchaseRequests = await PurchaseRequest.find(query)
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await PurchaseRequest.countDocuments(query);

    res.status(200).json({
      success: true,
      data: purchaseRequests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("Get purchase requests error:", error);
    res.status(500).json({
      success: false,
      message: "Server error retrieving purchase requests"
    });
  }
};

// @desc    Get single purchase request by ID
// @route   GET /api/purchase-requests/:id
// @access  Private
exports.getPurchaseRequestById = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const purchaseRequest = await PurchaseRequest.findOne({
      _id: req.params.id,
      companyId: user.companyId,
      isDeleted: false
    }).populate('createdBy', 'firstName lastName email');

    if (!purchaseRequest) {
      return res.status(404).json({
        success: false,
        message: "Purchase request not found"
      });
    }

    res.status(200).json({
      success: true,
      data: purchaseRequest
    });

  } catch (error) {
    console.error("Get purchase request by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Server error retrieving purchase request"
    });
  }
};

// @desc    Update purchase request status (for approval workflow)
// @route   PUT /api/purchase-requests/:id/status
// @access  Private (approvers only)
exports.updatePurchaseRequestStatus = async (req, res) => {
  try {
    const { status, approvedBy, checkedBy, verifiedBy, preparedBy } = req.body;

    if (!['pending', 'checked', 'verified', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status"
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const purchaseRequest = await PurchaseRequest.findOne({
      _id: req.params.id,
      companyId: user.companyId,
      isDeleted: false
    });

    if (!purchaseRequest) {
      return res.status(404).json({
        success: false,
        message: "Purchase request not found"
      });
    }

    // Update status and approvers
    purchaseRequest.status = status;
    if (preparedBy) purchaseRequest.preparedBy = preparedBy;
    if (checkedBy) purchaseRequest.checkedBy = checkedBy;
    if (verifiedBy) purchaseRequest.verifiedBy = verifiedBy;
    if (approvedBy) purchaseRequest.approvedBy = approvedBy;

    await purchaseRequest.save();

    res.status(200).json({
      success: true,
      message: "Purchase request status updated successfully",
      data: purchaseRequest
    });

  } catch (error) {
    console.error("Update purchase request status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating purchase request status"
    });
  }
};

// @desc    Delete purchase request (soft delete)
// @route   DELETE /api/purchase-requests/:id
// @access  Private (creator only)
exports.deletePurchaseRequest = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const purchaseRequest = await PurchaseRequest.findOne({
      _id: req.params.id,
      companyId: user.companyId,
      createdBy: user._id,
      isDeleted: false
    });

    if (!purchaseRequest) {
      return res.status(404).json({
        success: false,
        message: "Purchase request not found or you don't have permission to delete it"
      });
    }

    // Soft delete
    purchaseRequest.isDeleted = true;
    purchaseRequest.deletedAt = new Date();
    await purchaseRequest.save();

    res.status(200).json({
      success: true,
      message: "Purchase request deleted successfully"
    });

  } catch (error) {
    console.error("Delete purchase request error:", error);
    res.status(500).json({
      success: false,
      message: "Server error deleting purchase request"
    });
  }
};