const jwt = require("jsonwebtoken");
const env = require("../config/env");

const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      email: user.email,
      role: user.role,
      companyId: user.companyId // ← ADD THIS!
    },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_EXPIRES_IN,
    }
  );
};

module.exports = generateToken;
