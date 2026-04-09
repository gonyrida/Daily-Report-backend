const jwt = require("jsonwebtoken");
// dotenv.config() is already called in server.js

const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      email: user.email,
      role: user.role,
      companyId: user.companyId // ← ADD THIS!
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    }
  );
};

module.exports = generateToken;
