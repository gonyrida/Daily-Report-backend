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
    message: "Too many password reset attempts. Please try again later.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    console.warn(`Rate limit exceeded for IP: ${req.ip} at ${new Date().toISOString()}`);
    res.status(429).json({
      success: false,
      message: "Too many password reset attempts. Please try again later.",
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
    message: "Too many password reset attempts. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`Password reset confirmation rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: "Too many password reset attempts. Please try again later.",
      retryAfter: Math.round(15 * 60),
    });
  },
});

module.exports = {
  passwordResetRateLimit,
  passwordResetConfirmRateLimit,
};
