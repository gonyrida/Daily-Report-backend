const RequestAuditLog = require("../models/requestAuditLogModel");

const createAuditLog = async (requestId, requestLabel, approver, role, department, status, actionType, notes = null, previousState = null, newState = null) => {
  try {
    const auditLog = new RequestAuditLog({
      requestId,
      requestLabel,
      approver,
      role,
      department,
      status,
      actionType,
      notes,
      previousState,
      newState,
      timestamp: new Date()
    });
    await auditLog.save();
  } catch (error) {
    console.error("Error creating audit log:", error);
  }
};

module.exports = { createAuditLog };