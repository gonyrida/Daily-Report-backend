// Add at the top of adminController.js
const crypto = require('crypto');

/**
 * Generate a secure random password
 * @returns {String} Random 12-character password
 */
const generateSecurePassword = () => {
  const length = 12;
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  
  // Ensure at least one of each character type
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[crypto.randomInt(0, 26)];
  password += 'abcdefghijklmnopqrstuvwxyz'[crypto.randomInt(0, 26)];
  password += '0123456789'[crypto.randomInt(0, 10)];
  password += '!@#$%^&*'[crypto.randomInt(0, 8)];
  
  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    password += charset[crypto.randomInt(0, charset.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => crypto.randomInt(-1, 2)).join('');
};

module.exports = { 
  generateSecurePassword
}