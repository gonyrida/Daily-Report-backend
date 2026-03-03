/**
 * Validates approver assignments for purchase request workflow
 * @param {Object} approvers - Object containing checkedBy, verifiedBy, approvedBy
 * @param {String} preparerId - The ID of the user creating the request
 * @returns {Object} - { valid: boolean, message: string }
 */
const validateApproverWorkflow = (approvers, preparerId) => {
  const { checkedBy, verifiedBy, approvedBy } = approvers || {};
  
  // Only validate if at least one approver is provided
  const providedApprovers = [checkedBy, verifiedBy, approvedBy].filter(id => id && id !== null);
  
  if (providedApprovers.length === 0) {
    return { valid: true, message: null };
  }

  // Check 1: Self-approval - preparer cannot be any approver
  if (checkedBy === String(preparerId) || 
      verifiedBy === String(preparerId) || 
      approvedBy === String(preparerId)) {
    return { 
      valid: false, 
      message: "You cannot assign yourself as an approver in any stage" 
    };
  }

  // Check 2: Duplicate approvers across different stages
  const uniqueApprovers = new Set(providedApprovers);
  if (uniqueApprovers.size !== providedApprovers.length) {
    return { 
      valid: false, 
      message: "The same user cannot be assigned to multiple approval stages" 
    };
  }

  // Check 3: Sequential logic - if approvedBy is set, at least one of checkedBy or verifiedBy should be set
  if (approvedBy && !checkedBy && !verifiedBy) {
    return { 
      valid: false, 
      message: "Final approver requires at least a checker or verifier to be assigned" 
    };
  }

  return { valid: true, message: null };
};

module.exports = { validateApproverWorkflow };