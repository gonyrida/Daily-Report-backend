const rateLimit = require("express-rate-limit");

/**
 * Rate limiting middleware for password reset requests
 * Limits to 3 requests per 15 minutes per IP address
 */
const passwordResetRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Limit each IP to 3 requests per windowMs
  message: {
    success: false,
    message: "Too many password reset attempts. Please try again later in 15 minutes.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req, res) => {
    // Use email as key if available, otherwise fallback to IP
    return req.body?.email || req.ip;
  },
  handler: (req, res) => {
    console.warn(`Rate limit exceeded for Email: ${req.body?.email} at ${new Date().toISOString()}`);
    res.status(429).json({
      success: false,
      message: "Too many password reset attempts. Please try again later in 15 minutes.",
      retryAfter: Math.round(15 * 60), // 15 minutes in seconds
    });
  },
});

/**
 * Rate limiting middleware for password reset confirmation
 * Limits to 5 attempts per 15 minutes per IP address
 */
const passwordResetConfirmRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: "Too many password reset attempts. Please try again later in 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    // Use email as key if available, otherwise fallback to IP
    return req.body?.email || req.ip;
  },
  handler: (req, res) => {
    console.warn(`Password reset confirmation rate limit exceeded for Email: ${req.body?.email}`);
    res.status(429).json({
      success: false,
      message: "Too many password reset attempts. Please try again later in 15 minutes.",
      retryAfter: Math.round(15 * 60), // 15 minutes in seconds
    });
  },
});

module.exports = {
  passwordResetRateLimit,
  passwordResetConfirmRateLimit,
};
