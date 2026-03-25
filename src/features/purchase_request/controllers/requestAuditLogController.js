const RequestAuditLog = require("../models/requestAuditLogModel");
const PurchaseRequest = require("../models/purchaseRequestModel");
const User = require("../../../models/userModel");

// @desc    Get audit logs for a purchase request
// @route   GET /api/purchase-requests/:id/audit-logs
// @access  Private
exports.getAuditLogs = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Verify the purchase request exists and user has access
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

    const auditLogs = await RequestAuditLog.find({ requestId: req.params.id })
      .populate('approver', 'firstName lastName email')
      .sort({ timestamp: -1 });

    res.status(200).json({
      success: true,
      data: auditLogs
    });

  } catch (error) {
    console.error("Get audit logs error:", error);
    res.status(500).json({
      success: false,
      message: "Server error retrieving audit logs"
    });
  }
};

// @desc    Add comment to audit logs
// @route   POST /api/purchase-requests/:id/audit-logs/comment
// @access  Private
exports.addComment = async (req, res) => {
  try {
    const { notes } = req.body;
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (!notes || notes.trim() === '') {
      return res.status(400).json({
        success: false,
        message: "Comment cannot be empty"
      });
    }

    // Verify the purchase request exists and user has access
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

    // Find specific workflow step
    const workflowStep = purchaseRequest.approvalWorkflow.find(
      step => step.approver.toString() === user._id.toString()
    );

    // Create comment audit log
    const commentLog = new RequestAuditLog({
      requestId: req.params.id,
      approver: user._id,
      role: workflowStep?.role || 'commented', // Comments don't have specific roles
      department: user.department || 'unknown',
      status: 'completed',
      actionType: 'commented',
      notes: notes.trim(),
      timestamp: new Date()
    });

    await commentLog.save();
    await commentLog.populate('approver', 'firstName lastName email');

    res.status(201).json({
      success: true,
      message: "Comment added successfully",
      data: commentLog
    });

  } catch (error) {
    console.error("Add comment error:", error);
    res.status(500).json({
      success: false,
      message: "Server error adding comment"
    });
  }
};