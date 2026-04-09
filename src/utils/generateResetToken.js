const jwt = require("jsonwebtoken");
// dotenv.config() is already called in server.js

/**
 * Generate a secure JWT token for password reset
 * @param {Object} user - User object containing _id, email, resetVersion
 * @returns {String} JWT token
 */
const generatePasswordResetToken = (user) => {
  const payload = {
    userId: user._id,
    email: user.email,
    purpose: "reset-password",
    resetVersion: user.resetVersion || 0,
    iat: Math.floor(Date.now() / 1000),
  };

  return jwt.sign(payload, process.env.JWT_RESET_SECRET, {
    expiresIn: process.env.JWT_RESET_EXPIRES_IN || '10m',
    issuer: "cacpm-backend",
    audience: "cacpm-frontend",
  });
};

/**
 * Verify and decode password reset token
 * @param {String} token - JWT token to verify
 * @returns {Object} Decoded payload
 * @throws {Error} If token is invalid or expired
 */
const verifyPasswordResetToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_RESET_SECRET, {
      issuer: "cacpm-backend",
      audience: "cacpm-frontend",
    });

    // Validate token purpose
    if (decoded.purpose !== "reset-password") {
      throw new Error("Invalid token purpose");
    }

    return decoded;
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new Error("Password reset token has expired");
    } else if (error.name === "JsonWebTokenError") {
      throw new Error("Invalid password reset token");
    } else {
      throw error;
    }
  }
};

/**
 * Check if token is still valid based on user's current reset version
 * @param {Object} decodedToken - Decoded JWT payload
 * @param {Object} user - User object from database
 * @returns {Boolean} True if token is valid
 */
const isTokenVersionValid = (decodedToken, user) => {
  return (
    decodedToken.resetVersion === (user.resetVersion || 0) &&
    decodedToken.userId === user._id.toString() &&
    decodedToken.email === user.email
  );
};

module.exports = {
  generatePasswordResetToken,
  verifyPasswordResetToken,
  isTokenVersionValid,
};
