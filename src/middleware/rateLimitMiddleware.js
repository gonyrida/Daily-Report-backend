const rateLimit = require('express-rate-limit');

// General rate limiting for all requests
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute (changed from 15 minutes)
  max: 500, // Limit each IP to 500 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Strict rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 20 : 40, // Higher limit for development
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Rate limiting for sensitive operations (password reset, etc.)
const sensitiveLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 sensitive requests per hour
  message: {
    success: false,
    message: 'Too many sensitive requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for Excel export (resource intensive)
const exportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes (changed from 1 hour)
  max: 20, // Limit each user to 20 exports per 15 minutes
  keyGenerator: (req) => {
    // Safely access user ID with fallback to IP
    try {
      const userId = req.user?.userId;
      if (userId) return userId.toString();
    } catch (error) {
      console.warn('Error accessing user ID in rate limiter:', error.message);
    }
    
    // Handle IPv6 by using IP address fallback
    const ip = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
    return ip && ip.includes(':') ? ip.replace(/:/g, '') : ip;
  },
  message: {
    success: false,
    message: 'Too many export requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  generalLimiter,
  authLimiter,
  sensitiveLimiter,
  exportLimiter,
};
