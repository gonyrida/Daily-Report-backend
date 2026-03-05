// src/features/purchase_request/controllers/purchaseRequestController.js
const PurchaseRequest = require("../models/purchaseRequestModel");
const User = require("../../../models/userModel");
const { 
  validateApproverWorkflow
} = require("../helpers/validationApproverWorkflow");

// Define order of the approval workflow roles
const ROLE_ORDER = ['checked','verified','approved'];

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
      priority,
      status, // NEW: Extract status
      approvers // NEW: Extract approvers
    } = req.body;

    // Validation
    if (status !== 'draft' && (!requesterName || !requesterDepartment || !projectName || !purpose || !requestDate || !deliveryPlace)) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided for posted requests"
      });
    }

    if (status !== 'draft' && (!items || items.length === 0)) {
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

    // Validate approver workflow assignments
    const workflowValidation = validateApproverWorkflow(approvers, req.user.userId);
    if (!workflowValidation.valid) {
      return res.status(400).json({
        success: false,
        message: workflowValidation.message
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
      status: status || 'pending', // default to 'Pending' if not provided
      approvalWorkflow: [
        {
          approver: user._id,  // Current user as preparer
          role: 'prepared',
          status: 'completed',
          timestamp: new Date(),
          notes: 'Request prepared by user'
        },
        {
          approver: approvers?.checkedBy || null,
          role: 'checked',
          status: 'pending',
          timestamp: null,
          notes: null
        },
        {
          approver: approvers?.verifiedBy || null,
          role: 'verified', 
          status: 'pending',
          timestamp: null,
          notes: null
        },
        {
          approver: approvers?.approvedBy || null,
          role: 'approved',
          status: 'pending', 
          timestamp: null,
          notes: null
        }
      ],
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
      isDeleted: false,
      status: { $ne: 'draft' }  // exclude drafts
    };

    // Comment out the Filter by status if provided for future usage
    // if (status) {
      // query.status = status;
    // }

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
      .populate('createdBy', 'firstName lastName email approvalWorkflow')
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
    }).populate('createdBy', 'firstName lastName email approvalWorkflow');

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
    const { status, approverId, notes, role } = req.body;

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

    // Find and update the specific workflow step
    const workflowStep = purchaseRequest.approvalWorkflow.find(
      step => step.role === role
    );

    if (!workflowStep) {
      return res.status(400).json({
        success: false,
        message: "Workflow step not found"
      });
    }
    
    // Handle rejection immediately (no sequential validation needed)
    if (status === 'rejected') {
      workflowStep.approver = approverId;
      workflowStep.status = 'rejected';
      workflowStep.timestamp = new Date();
      workflowStep.notes = notes;
      
      purchaseRequest.status = 'rejected';
      await purchaseRequest.save();
      
      return res.status(200).json({
        success: true,
        message: "Purchase request rejected successfully",
        data: purchaseRequest
      });
    }

    const currentIdx = ROLE_ORDER.indexOf(role);
    if (currentIdx > 0) {
      const earlierIncomplete = purchaseRequest.approvalWorkflow
        .filter(s => ROLE_ORDER.indexOf(s.role) < currentIdx)
        .some(s => s.status !== 'approved' && s.status !== 'rejected' && s.status !== 'completed');
      if (earlierIncomplete) {
        return res.status(400).json({
          success: false,
          message: 'Cannot act on this step until previous step(s) are completed'
        });
      }
    }

    // Update workflow step for approval
    workflowStep.approver = approverId;
    workflowStep.status = 'approved';
    workflowStep.timestamp = new Date();
    workflowStep.notes = notes;

    // Determine overall purchase request status:
    // - If this action is a rejection, mark request as 'rejected'
    // - Else if all workflow steps are completed -> 'approved'
    // - Otherwise keep as 'pending'
    const allApproved = purchaseRequest.approvalWorkflow.every(s => 
      (s.role === 'prepared' && s.status === 'completed') || 
      (s.role !== 'prepared' && s.status === 'approved')
    );
    const hasRejection = purchaseRequest.approvalWorkflow.some(s => s.status === 'rejected');

    if (hasRejection) {
      purchaseRequest.status = 'rejected';
    } else if (allApproved) {
      purchaseRequest.status = 'approved';
    } else {
      purchaseRequest.status = 'pending';
    }

    console.log('Updated workflow step:', workflowStep);
    console.log('Full workflow after update:', purchaseRequest.approvalWorkflow);

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

// @desc    Get all users in company
// @route   GET /api/purchase-requests/users
// @access  Public (Authenticated Only)
exports.getAllUsers = async (req, res) => {
  try {
    const { companyId } = req.user;
    
    // Get ALL active users in company
    const users = await User.find({ 
      companyId,
      isActive: true 
    }).select('firstName lastName email role department _id');
    
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
};

// @desc    Get current user's purchase requests only
// @route   GET /api/purchase-requests/my-requests
// @access  Private
exports.getMyPurchaseRequests = async (req, res) => {
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

    // Query for user's requests only
    let query = {
      companyId: user.companyId,
      createdBy: user._id,  // KEY: Only user's requests
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

    const purchaseRequests = await PurchaseRequest.find(query)
      .populate('createdBy', 'firstName lastName email approvalWorkflow')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

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
    console.error("Get my purchase requests error:", error);
    res.status(500).json({
      success: false,
      message: "Server error retrieving purchase requests"
    });
  }
};

// @desc    Update current user's purchase requests only
// @route   PUT /api/purchase-requests/:id
// @access  Private
exports.updatePurchaseRequest = async (req, res) => {
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
      approvers,
      priority,
      status
    } = req.body;

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

    // Ownership guard: Only owner can update
    if (!purchaseRequest || String(purchaseRequest.createdBy) !== String(user._id)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this purchase request"
      });
    }

    if (!purchaseRequest) {
      return res.status(404).json({
        success: false,
        message: "Purchase request not found"
      });
    }

    // disallow edits once the status has moved past the initial state
    if (!['draft', 'pending'].includes(purchaseRequest.status)) {
      return res.status(400).json({
        success: false,
        message: "Cannot edit a request after it has been processed"
      });
    }

    // or inspect the workflow itself
    const approvalStarted = purchaseRequest.approvalWorkflow.some(
      step => step.role !== 'prepared' && step.status === 'completed'
    );
    if (approvalStarted) {
      return res.status(400).json({
        success: false,
        message: "Cannot modify request after an approver has completed a step"
      });
    }

    // Validate approver workflow when updating
    if (approvers) {
      const workflowValidation = validateApproverWorkflow(approvers, purchaseRequest.createdBy);
      if (!workflowValidation.valid) {
        return res.status(400).json({
          success: false,
          message: workflowValidation.message
        });
      }
    }

    // Update fields
    purchaseRequest.requesterName = requesterName;
    purchaseRequest.requesterDepartment = requesterDepartment;
    purchaseRequest.projectName = projectName;
    purchaseRequest.purpose = purpose;
    purchaseRequest.requestDate = requestDate;
    purchaseRequest.deliveryPlace = deliveryPlace;
    purchaseRequest.categories = categories;
    purchaseRequest.items = items;
    if (approvers) {
      // Update the approvalWorkflow with new approver IDs
      const checkedStep = purchaseRequest.approvalWorkflow.find(step => step.role === 'checked');
      const verifiedStep = purchaseRequest.approvalWorkflow.find(step => step.role === 'verified');
      const approvedStep = purchaseRequest.approvalWorkflow.find(step => step.role === 'approved');
      
      if (checkedStep) checkedStep.approver = approvers.checkedBy || null;
      if (verifiedStep) verifiedStep.approver = approvers.verifiedBy || null;
      if (approvedStep) approvedStep.approver = approvers.approvedBy || null;
    }
    purchaseRequest.priority = priority;
    purchaseRequest.status = status;

    await purchaseRequest.save();

    res.status(200).json({
      success: true,
      message: "Purchase request updated successfully",
      data: purchaseRequest
    });

  } catch (error) {
    console.error("Update purchase request error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating purchase request"
    });
  }
};

// @desc    Get purchase requests needing approval for a specific approver/admin
// @route   GET /api/purchase-requests/pending-approvals
// @access  Private
exports.getPendingApprovals = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Find requests where approvalWorkflow contains this user as approver/admin and status is pending
    const query = {
      companyId: user.companyId,
      isDeleted: false,
      status: { $nin: ['draft', 'rejected'] },
      approvalWorkflow: {
        $elemMatch: {
          approver: user._id,
          status: 'pending'
        }
      }
    };

    const requests = await PurchaseRequest.find(query)
      .populate('createdBy', 'firstName lastName email approvalWorkflow')

    res.status(200).json({
      success: true,
      data: requests
    });
  } catch (error) {
    console.error("Get pending approvals error:", error);
    res.status(500).json({
      success: false,
      message: "Server error retrieving pending approvals"
    });
  }
};