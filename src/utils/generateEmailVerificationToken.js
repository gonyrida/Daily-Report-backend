const crypto = require('crypto');

const generateEmailVerificationToken = () => {
  const verificationToken = crypto.randomBytes(32).toString('hex');
  
  // Token expires in 24 hours
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  
  return {
    token: verificationToken,
    expires: expires
  };
};

const verifyEmailToken = (user, token) => {
  if (!user.emailVerificationToken || !user.emailVerificationExpires) {
    return { valid: false, message: 'No verification token found' };
  }
  
  if (user.emailVerificationToken !== token) {
    return { valid: false, message: 'Invalid verification token' };
  }
  
  if (Date.now() > user.emailVerificationExpires) {
    return { valid: false, message: 'Verification token expired' };
  }
  
  return { valid: true, message: 'Token is valid' };
};

module.exports = {
  generateEmailVerificationToken,
  verifyEmailToken
};
