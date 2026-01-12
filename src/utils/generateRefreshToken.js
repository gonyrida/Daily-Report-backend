const jwt = require("jsonwebtoken");
const env = require("../config/env");

const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      email: user.email,
      type: "refresh", // Mark as refresh token
    },
    env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: env.REFRESH_TOKEN_EXPIRES_IN,
    }
  );
};

module.exports = generateRefreshToken;
