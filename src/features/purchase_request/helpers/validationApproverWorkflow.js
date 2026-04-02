/**
 * Validates approver assignments for purchase request workflow
 * @param {Object} approvers - Object containing checkedBy, verifiedBy, approvedBy and backup approvers
 * @param {String} preparerId - The ID of the user creating the request
 * @returns {Object} - { valid: boolean, message: string }
 */
const validateApproverWorkflow = (approvers, preparerId) => {
  const { 
    checkedBy, verifiedBy, approvedBy,
    backupCheckedBy, backupVerifiedBy, backupApprovedBy
  } = approvers || {};
  
  // Collect all primary approvers
  const primaryApprovers = [checkedBy, verifiedBy, approvedBy].filter(id => id && id !== null);
  // Collect all backup approvers
  const backupApprovers = [backupCheckedBy, backupVerifiedBy, backupApprovedBy].filter(id => id && id !== null);
  // Collect all approvers (primary + backup)
  const allApprovers = [...primaryApprovers, ...backupApprovers];
  
  // Only validate if at least one approver is provided
  if (allApprovers.length === 0) {
    return { valid: true, message: null };
  }

  // Check 1: Self-approval - preparer cannot be any approver (primary or backup)
  if (checkedBy === String(preparerId) || 
      verifiedBy === String(preparerId) || 
      approvedBy === String(preparerId) ||
      backupCheckedBy === String(preparerId) ||
      backupVerifiedBy === String(preparerId) ||
      backupApprovedBy === String(preparerId)) {
    return { 
      valid: false, 
      message: "You cannot assign yourself as an approver or backup approver in any stage" 
    };
  }

  // Check 2: Duplicate approvers across different stages (primary + backup combined)
  const uniqueApprovers = new Set(allApprovers);
  if (uniqueApprovers.size !== allApprovers.length) {
    return { 
      valid: false, 
      message: "The same user cannot be assigned to multiple approval stages (including backup roles)" 
    };
  }

  // Check 3: Backup approver cannot be the same as primary approver for the same stage
  if (checkedBy && backupCheckedBy && checkedBy === backupCheckedBy) {
    return {
      valid: false,
      message: "Checked By and Backup Checked By cannot be the same user"
    };
  }
  if (verifiedBy && backupVerifiedBy && verifiedBy === backupVerifiedBy) {
    return {
      valid: false,
      message: "Verified By and Backup Verified By cannot be the same user"
    };
  }
  if (approvedBy && backupApprovedBy && approvedBy === backupApprovedBy) {
    return {
      valid: false,
      message: "Approved By and Backup Approved By cannot be the same user"
    };
  }

  // Check 4: Sequential logic - if approvedBy is set, at least one of checkedBy or verifiedBy should be set
  if (approvedBy && !checkedBy && !verifiedBy) {
    return { 
      valid: false, 
      message: "Final approver requires at least a checker or verifier to be assigned" 
    };
  }

  return { valid: true, message: null };
};

module.exports = { validateApproverWorkflow };