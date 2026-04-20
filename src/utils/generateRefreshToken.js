const jwt = require("jsonwebtoken");
// dotenv.config() is already called in server.js

const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      email: user.email,
      type: "refresh", // Mark as refresh token
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

module.exports = generateRefreshToken;
