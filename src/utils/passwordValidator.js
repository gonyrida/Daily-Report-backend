/**
 * Password strength validation utility
 * Follows OWASP password guidelines
 */

/**
 * Validate password strength according to OWASP guidelines
 * @param {String} password - Password to validate
 * @returns {Object} Validation result with isValid and errors array
 */
const validatePasswordStrength = (password) => {
  const errors = [];

  // Minimum length check (OWASP recommends at least 8 characters)
  if (!password || password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }

  // Maximum length check (prevent DoS attacks)
  if (password && password.length > 128) {
    errors.push("Password must not exceed 128 characters");
  }

  // Check for common weak patterns
  if (password) {
    // No whitespace
    if (/\s/.test(password)) {
      errors.push("Password cannot contain whitespace characters");
    }

    // Check for at least one lowercase letter
    if (!/[a-z]/.test(password)) {
      errors.push("Password must contain at least one lowercase letter");
    }

    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
      errors.push("Password must contain at least one uppercase letter");
    }

    // Check for at least one number
    if (!/\d/.test(password)) {
      errors.push("Password must contain at least one number");
    }

    // Check for at least one special character
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push("Password must contain at least one special character");
    }

    // Check for common patterns (basic implementation)
    const commonPatterns = [
      /^(.)\1+$/, // Repeated characters like "aaaa"
      /^(123|abc|qwe)/i, // Common sequences
      /password/i, // Contains "password"
      /admin/i, // Contains "admin"
    ];

    for (const pattern of commonPatterns) {
      if (pattern.test(password)) {
        errors.push("Password contains common or weak patterns");
        break;
      }
    }

    // Check if password is entirely numeric
    if (/^\d+$/.test(password)) {
      errors.push("Password cannot be entirely numeric");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Generate password strength score (0-100)
 * @param {String} password - Password to evaluate
 * @returns {Object} Strength score and feedback
 */
const getPasswordStrength = (password) => {
  if (!password) return { score: 0, feedback: "Password is required" };

  let score = 0;
  const feedback = [];

  // Length contribution (up to 40 points)
  if (password.length >= 8) score += 20;
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;

  // Character variety (up to 40 points)
  if (/[a-z]/.test(password)) {
    score += 10;
  } else {
    feedback.push("Add lowercase letters");
  }

  if (/[A-Z]/.test(password)) {
    score += 10;
  } else {
    feedback.push("Add uppercase letters");
  }

  if (/\d/.test(password)) {
    score += 10;
  } else {
    feedback.push("Add numbers");
  }

  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    score += 10;
  } else {
    feedback.push("Add special characters");
  }

  // Entropy bonus (up to 20 points)
  const uniqueChars = new Set(password).size;
  if (uniqueChars >= password.length * 0.6) score += 10;
  if (uniqueChars >= password.length * 0.8) score += 10;

  // Deduct points for common patterns
  if (/(.)\1{2,}/.test(password)) score -= 10; // Repeated characters
  if (/^(123|abc|qwe)/i.test(password)) score -= 10; // Common sequences

  score = Math.max(0, Math.min(100, score));

  let strength = "Very Weak";
  if (score >= 80) strength = "Very Strong";
  else if (score >= 60) strength = "Strong";
  else if (score >= 40) strength = "Moderate";
  else if (score >= 20) strength = "Weak";

  return {
    score,
    strength,
    feedback: feedback.length > 0 ? feedback : ["Password looks good!"],
  };
};

module.exports = {
  validatePasswordStrength,
  getPasswordStrength,
};
