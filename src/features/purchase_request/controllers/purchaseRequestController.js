// src/features/purchase_request/controllers/purchaseRequestController.js
const PurchaseRequest = require("../models/purchaseRequestModel");
const User = require("../../../models/userModel");
const { 
  validateApproverWorkflow
} = require("../helpers/validationApproverWorkflow");
const { createAuditLog } = require("../helpers/createAuditLog");
const PR_Project = require("../models/projectPRModel");

// Normalize attachment fileSize from formatted strings to bytes numbers
function parseAttachmentFileSize(fileSize) {
  if (fileSize === null || fileSize === undefined) return 0;
  if (typeof fileSize === 'number') return fileSize;
  if (typeof fileSize !== 'string') return 0;

  const normalized = fileSize.trim().toUpperCase();
  const parts = normalized.split(' ');
  if (parts.length === 0) return 0;

  let value = parseFloat(parts[0].replace(/,/g, ''));
  if (isNaN(value)) return 0;

  const unit = parts[1] || 'B';
  if (unit.startsWith('KB')) return Math.round(value * 1024);
  if (unit.startsWith('MB')) return Math.round(value * 1024 * 1024);
  if (unit.startsWith('GB')) return Math.round(value * 1024 * 1024 * 1024);
  if (unit.startsWith('TB')) return Math.round(value * 1024 * 1024 * 1024 * 1024);
  return Math.round(value);
}

function normalizeAttachments(attachments) {
  if (!Array.isArray(attachments)) return [];
  return attachments.map(att => {
    const fileSize = parseAttachmentFileSize(att.fileSize);
    // Handle data URL format: data:mime/type;base64,actualData
    let base64Data = att.base64;
    if (base64Data && base64Data.includes(',')) {
      base64Data = base64Data.split(',')[1];
    }
    const bufferData = att.data || (base64Data ? Buffer.from(base64Data, 'base64') : undefined);
    return {
      ...att,
      fileSize,
      data: bufferData,
      base64: att.base64 || att.imageData || null,
    };
  });
}

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
      projectFrom,
      purpose,
      requestDate,
      dueDate,
      deliveryPlace,
      categories,
      items,
      priority,
      status,
      approvers,
      requestDescription,
      requestRemarks,
      attachments
    } = req.body;

    // Comment out for now but will have to apply safe guards to check
    // if user is allow to post a request asscociated with a project
    // const projectId = projectFrom?.mainId;
    // let project = null;
    // if (projectId) {
    //   project = await PR_Project.findById(projectId);
    //   if (!project) {
    //     return res.status(404).json({
    //       success: false,
    //       message: "Project not found"
    //     });
    //   }
    // }

    // Validation
    if (status !== 'draft' && (!requesterName || !requesterDepartment || !projectName || !purpose || !requestDate || !dueDate || !deliveryPlace)) {
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

    // Normalize attachments and file size from frontend metadata
    const normalizedAttachments = normalizeAttachments(attachments);

    const projectId = projectFrom?.mainId;
    let project = null;
    let projectCounter = null;
    if (projectId && status === 'pending') {
      project = await PR_Project.findByIdAndUpdate(
        projectId,
        { $inc: { counter: 1 } }, 
        { new: true }
      );
      projectCounter = project.counter;
    } else if (projectId && status === 'draft') {
      projectCounter = 0;
    } else if (!projectId && status === 'pending') {
      projectCounter = 1;
    } else if (!projectId && status === 'draft') {
      projectCounter = 0;
    }

    // Create purchase request
    const purchaseRequest = new PurchaseRequest({
      requesterName,
      requesterDepartment,
      groupId: null, // Will be set to request ID after creation
      version: 0, // Start with version 0
      no: projectCounter,
      label: `MR #${projectCounter}`,
      projectName,
      projectFrom: projectFrom || {
        mainProject: null,
        mainId: null,
        subProject: null,
        subId: null
      },
      purpose,
      requestDate,
      dueDate,
      deliveryPlace,
      categories: categories || {
        construction: false,
        admin: false,
        material: false,
        services: false
      },
      items,
      requestDescription,
      requestRemarks,
      attachments: normalizedAttachments,
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
          backupApprover: approvers?.backupCheckedBy || null,
          role: 'checked',
          status: 'pending',
          timestamp: null,
          notes: null
        },
        {
          approver: approvers?.verifiedBy || null,
          backupApprover: approvers?.backupVerifiedBy || null,
          role: 'verified', 
          status: 'pending',
          timestamp: null,
          notes: null
        },
        {
          approver: approvers?.approvedBy || null,
          backupApprover: approvers?.backupApprovedBy || null,
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

    // Log creation action
    await createAuditLog(
      purchaseRequest._id,
      purchaseRequest.label,
      user._id,
      'prepared',
      user.department || 'unknown',
      'completed',
      'created',
      'Request created by user'
    );

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

    const previousState = {
      status: purchaseRequest.status,
      workflowStep: { ...workflowStep.toObject() }
    };
    
    // Handle rejection immediately (no sequential validation needed)
    if (status === 'rejected') {
      workflowStep.approver = approverId;
      workflowStep.status = 'rejected';
      workflowStep.timestamp = new Date();
      workflowStep.notes = notes;
      
      purchaseRequest.status = 'rejected';
      await purchaseRequest.save();
      
      // Add audit log for rejection
      const approverUser = await User.findById(approverId);
      await createAuditLog(
        purchaseRequest._id,
        purchaseRequest.label,
        approverId,
        role,
        approverUser?.department || 'unknown',
        'rejected',
        'rejected',
        notes,
        previousState,
        { status: 'rejected', workflowStep: { ...workflowStep.toObject() } }
      );
      
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

    const newState = {
      status: purchaseRequest.status,
      workflowStep: { ...workflowStep.toObject() }
    };

    const approverUser = await User.findById(approverId);
    await createAuditLog(
      purchaseRequest._id,
      purchaseRequest.label,
      approverId,
      role,
      approverUser?.department || 'unknown',
      status === 'rejected' ? 'rejected' : 'approved',
      status === 'rejected' ? 'rejected' : 'approved',
      notes,
      previousState,
      newState
    );

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

    // Log cancellation action
    await createAuditLog(
      purchaseRequest._id,
      purchaseRequest.label,
      user._id,
      'prepared',
      user.department || 'unknown',
      'completed',
      'cancelled',
      'Request deleted by creator'
    );

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
      projectFrom,
      purpose,
      requestDate,
      dueDate,
      deliveryPlace,
      categories,
      items,
      approvers,
      priority,
      status,
      requestDescription,
      requestRemarks,
      attachments
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
      step => step.role !== 'prepared' && step.status === 'approved'
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

    const normalizedAttachments = normalizeAttachments(attachments);

    if (purchaseRequest.status === 'pending' && status === 'draft') {
      return res.status(400).json({
        success: false,
        message: "Cannot change status from pending to draft"
      });
    }

    const projectId = projectFrom?.mainId;
    let project = null;
    let projectCounter = null;
    if (projectId && status === 'pending' && purchaseRequest.status === 'draft') {
      project = await PR_Project.findByIdAndUpdate(
        projectId, 
        { $inc: { counter: 1 } }, 
        { new: true }
      );
      projectCounter = project.counter;
    } else if (projectId && status === 'draft') {
      projectCounter = 0;
    } else if (!projectId && status === 'pending') {
      projectCounter = 1;
    } else if (!projectId && status === 'draft') {
      projectCounter = 0;
    }

    if (projectId) {
      if (status === 'pending' && purchaseRequest.status === 'draft') {
        project = await PR_Project.findByIdAndUpdate(
          projectId, 
          { $inc: { counter: 1 } }, 
          { new: true }
        );
        projectCounter = project.counter;
      } else if (status === 'pending' && purchaseRequest.status === 'pending') {
        projectCounter = purchaseRequest.no;
      } else if (status === 'draft' && purchaseRequest.status === 'draft') {
        projectCounter = 0;
      }
    } else {
      if (status === 'pending' && purchaseRequest.status === 'draft') {
        projectCounter = 1;
      } else if (status === 'pending' && purchaseRequest.status === 'pending') {
        projectCounter = purchaseRequest.no;
      } else if (status === 'draft' && purchaseRequest.status === 'draft') {
        projectCounter = 0;
      }
    }

    // Update fields
    purchaseRequest.requesterName = requesterName;
    purchaseRequest.requesterDepartment = requesterDepartment;
    purchaseRequest.no = projectCounter;
    purchaseRequest.label = `MR #${projectCounter}`;
    purchaseRequest.projectName = projectName;
    purchaseRequest.projectFrom = projectFrom;
    purchaseRequest.purpose = purpose;
    purchaseRequest.requestDate = requestDate;
    purchaseRequest.dueDate = dueDate;
    purchaseRequest.deliveryPlace = deliveryPlace;
    purchaseRequest.categories = categories;
    purchaseRequest.items = items;
    purchaseRequest.requestDescription = requestDescription;
    purchaseRequest.requestRemarks = requestRemarks;
    purchaseRequest.attachments = attachments;
    if (approvers) {
      // Update the approvalWorkflow with new approver IDs and backup approvers
      const checkedStep = purchaseRequest.approvalWorkflow.find(step => step.role === 'checked');
      const verifiedStep = purchaseRequest.approvalWorkflow.find(step => step.role === 'verified');
      const approvedStep = purchaseRequest.approvalWorkflow.find(step => step.role === 'approved');
      
      if (checkedStep) {
        checkedStep.approver = approvers.checkedBy || null;
        checkedStep.backupApprover = approvers.backupCheckedBy || null;
      }
      if (verifiedStep) {
        verifiedStep.approver = approvers.verifiedBy || null;
        verifiedStep.backupApprover = approvers.backupVerifiedBy || null;
      }
      if (approvedStep) {
        approvedStep.approver = approvers.approvedBy || null;
        approvedStep.backupApprover = approvers.backupApprovedBy || null;
      }
    }
    purchaseRequest.requestDescription = requestDescription;
    purchaseRequest.requestRemarks = requestRemarks;
    purchaseRequest.attachments = normalizedAttachments;
    purchaseRequest.priority = priority;
    if (purchaseRequest.status === 'draft' && status === 'pending') {
      purchaseRequest.status = status;
    }

    // Log modification action
    await createAuditLog(
      purchaseRequest._id,
      purchaseRequest.label,
      user._id,
      'prepared',
      user.department || 'unknown',
      'completed',
      'modified',
      'Request updated by creator'
    );

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

exports.revisedPurchaseRequest = async (req, res) => {
  try {
    const {
      requesterName,
      requesterDepartment,
      projectName,
      projectFrom,
      purpose,
      requestDate,
      dueDate,
      deliveryPlace,
      categories,
      items,
      approvers,
      notes,
      priority,
      requestDescription,
      requestRemarks,
      attachments
    } = req.body;

    const { comment } = req.query;

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const normalizedAttachments = normalizeAttachments(attachments);

    // Find original request
    const originalRequest = await PurchaseRequest.findById(req.params.id);
    if (!originalRequest) {
      return res.status(404).json({
        success: false,
        message: "Original purchase request not found"
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

    // Process attachments: convert base64 to Buffer if needed
    if (attachments && Array.isArray(attachments)) {
      attachments.forEach(attachment => {
        if (attachment.base64 && !attachment.data) {
          // Convert base64 to Buffer
          attachment.data = Buffer.from(attachment.base64, 'base64');
        }
      });
    }

    await PurchaseRequest.updateMany(
      { groupId: originalRequest.groupId },
      { isLatest: false }
    );

    // Create revised request with same groupId but incremented version
    const revisedRequest = new PurchaseRequest({
      requesterName,
      requesterDepartment,
      groupId: originalRequest.groupId, // Keep same groupId as original
      version: (originalRequest.version || 0) + 1, // Increment version
      no: originalRequest.no,
      label: `MR #${originalRequest.no} (R${(originalRequest.version || 0) + 1})`,
      projectName,
      projectFrom: projectFrom || {
        mainProject: null,
        mainId: null,
        subProject: null,
        subId: null
      },
      purpose,
      requestDate,
      dueDate,
      deliveryPlace,
      categories: categories || {
        construction: false,
        admin: false,
        material: false,
        services: false
      },
      items,
      requestDescription,
      requestRemarks,
      attachments: normalizedAttachments,
      status: 'pending', // Reset to pending for revision
      priority: priority || 'medium',
      companyId: user.companyId,
      createdBy: user._id,
      approvalWorkflow: [
        {
          approver: user._id,
          role: 'prepared',
          status: 'completed',
          timestamp: new Date(),
          notes: 'Request revised by user'
        },
        {
          approver: approvers?.checkedBy || null,
          backupApprover: approvers?.backupCheckedBy || null,
          role: 'checked',
          status: 'pending',
          timestamp: null,
          notes: null
        },
        {
          approver: approvers?.verifiedBy || null,
          backupApprover: approvers?.backupVerifiedBy || null,
          role: 'verified',
          status: 'pending',
          timestamp: null,
          notes: null
        },
        {
          approver: approvers?.approvedBy || null,
          backupApprover: approvers?.backupApprovedBy || null,
          role: 'approved',
          status: 'pending',
          timestamp: null,
          notes: null
        }
      ]
    });

    // Save revised request
    await revisedRequest.save();

    // Log revision action for original request
    await createAuditLog(
      originalRequest._id,
      originalRequest.label,
      user._id,
      'prepared',
      user.department || 'unknown',
      'revised',
      'revised',
      comment || 'Request revised - new version created'
    );

    // Log creation action for revised request
    await createAuditLog(
      revisedRequest._id,
      revisedRequest.label,
      user._id,
      'prepared',
      user.department || 'unknown',
      'completed',
      'created',
      `Revised request MR #${revisedRequest.no} (R-${revisedRequest.version}) created based on MR #${originalRequest.no} (R-${originalRequest.version})`
    );

    // Update original request status to indicate it has been revised
    await PurchaseRequest.findByIdAndUpdate(originalRequest._id, {
      status: 'revised'
    });

    // Populate user details for response
    await revisedRequest.populate('createdBy', 'firstName lastName email');

    res.status(201).json({
      success: true,
      message: "Purchase request revised successfully",
      data: revisedRequest
    });

  } catch (error) {
    console.error("Revise purchase request error:", error);
    res.status(500).json({
      success: false,
      message: "Server error revising purchase request"
    });
  }
};

// @desc    Get purchase requests summary for a project
// @route   GET /api/purchase-requests/pr-summary/:id
// @access  Private
exports.getProjectPurchaseRequestsSummary = async (req, res) => {
  try {
    const { id } = req.params; // Extract project ID from params

    // Find all purchase requests for the project with isLatest: true, sorted by no field
    const reports = await PurchaseRequest.find({ 
      'projectFrom.mainId': id, 
      isLatest: true 
    })
    .sort({ no: 1 }) // Sort by no field ascending
    .populate('createdBy', 'firstName lastName email')
    .populate('approvalWorkflow.approver', 'firstName lastName email');

    // Calculate report count
    const reportCount = reports.length;

    // Calculate cumulative total of grandTotal field
    const cumulativeTotal = reports.reduce((sum, report) => {
      return sum + (report.grandTotal || 0);
    }, 0);

    // Find the PR_Project to get budgetSettings and purposes
    const projectData = await PR_Project.findById(id)
      .select('budgetSettings purposes')
      .lean();

    // Calculate materialsActual - group totals by purpose
    const materialsActual = {};
    
    // Initialize materialsActual with project purposes
    if (projectData && projectData.purposes) {
      projectData.purposes.forEach(purpose => {
        materialsActual[purpose.name] = {
          purpose: purpose.name,
          actualTotal: 0
        };
      });
    }

    // Calculate actual totals for each purpose from reports
    reports.forEach(report => {
      if (report.purpose && materialsActual[report.purpose]) {
        materialsActual[report.purpose].actualTotal += (report.grandTotal || 0);
      }
    });

    // Convert to array format
    const materialsActualArray = Object.values(materialsActual);

    // Create summary object
    const summary = {
      totalSpend: cumulativeTotal,
      reportCount: reportCount,
      project: projectData || null, // Include project data with budgetSettings and purposes
      materialsActual: materialsActualArray // Include materialsActual accumulation
    };

    res.status(200).json({
      success: true,
      data: {
        reports: reports,
        summary: summary
      },
      message: `Found ${reportCount} purchase requests for project with total spend of ${cumulativeTotal}`
    });

  } catch (error) {
    console.error("Get project purchase requests summary error:", error);
    res.status(500).json({
      success: false,
      message: "Server error retrieving project purchase requests summary"
    });
  }
};