const PurchaseRequest = require("../models/purchaseRequestModel");
const RequestAuditLog = require("../models/requestAuditLogModel");

exports.deletePurchaseRequest = async (ids) => {
  if (!Array.isArray(ids) || ids.length === 0) {
    return {
      success: false,
      message: 'Please provide an array of material IDs'
    };
  }

  const result = await PurchaseRequest.deleteMany({
    _id: { $in: ids }
  });

  // Delete audit logs for deleted purchase requests
  await RequestAuditLog.deleteMany({
    purchaseRequestId: { $in: ids }
  });

  return {
    success: true,
    message: `${result.deletedCount} request(s) deleted successfully`,
    deleted: result.deletedCount
  };
}

module.exports = exports;