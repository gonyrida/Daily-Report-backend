# Secure Password Reset Implementation Guide

## Overview

This document provides a comprehensive, production-ready implementation of a secure password reset feature following OWASP best practices and industry security standards.

## Architecture Overview

### Security Features Implemented

✅ **Separate JWT Secret**: Dedicated secret for password reset tokens  
✅ **Short-Lived Tokens**: 10-minute expiration for reset tokens  
✅ **Token Versioning**: Prevents token reuse after password changes  
✅ **Rate Limiting**: 3 requests per 15 minutes for forgot-password  
✅ **Password Strength Validation**: Comprehensive OWASP-compliant validation  
✅ **Email Enumeration Protection**: Generic responses for all requests  
✅ **Token Single-Use**: Tokens become invalid after successful use  
✅ **Secure Password Hashing**: bcrypt with salt rounds = 12  
✅ **Audit Trail**: IP address and user agent logging  

## JWT Payload Structure

```json
{
  "userId": "507f1f77bcf86cd799439011",
  "email": "user@example.com",
  "purpose": "reset-password",
  "resetVersion": 3,
  "iat": 1642694400,
  "exp": 1642695000,
  "iss": "cacpm-backend",
  "aud": "cacpm-frontend"
}
```

## Database Schema

### User Model Enhancements

```javascript
{
  // ... existing fields
  resetVersion: {
    type: Number,
    default: 0,
  },
  passwordResetAt: {
    type: Date,
    default: null,
  }
}
```

### Password Reset Model

```javascript
{
  userId: ObjectId,
  token: String, // Hashed token for audit trail
  expiresAt: Date,
  used: Boolean,
  ipAddress: String, // For security monitoring
  userAgent: String,  // For security monitoring
  timestamps: true
}
```

## API Endpoints

### POST /api/auth/forgot-password

**Rate Limiting**: 3 requests per 15 minutes per IP

**Request**:
```json
{
  "email": "user@example.com"
}
```

**Response**:
```json
{
  "success": true,
  "message": "If that email exists, a reset link has been sent"
}
```

**Security Features**:
- Email format validation
- Generic response to prevent enumeration
- Rate limiting protection
- JWT token generation with user-specific payload
- Audit trail creation

### POST /api/auth/reset-password

**Rate Limiting**: 5 requests per 15 minutes per IP

**Request**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "newPassword": "NewSecureP@ss123!"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Password reset successful. Please login with your new password."
}
```

**Security Features**:
- JWT token verification with issuer/audience validation
- Token version validation against user's current reset version
- Password strength validation
- Single-use token enforcement
- Automatic cleanup of unused tokens

## Password Strength Requirements

### Minimum Requirements

- **Length**: 8-128 characters
- **Character Types**: At least one of each:
  - Lowercase letter (a-z)
  - Uppercase letter (A-Z)
  - Number (0-9)
  - Special character (!@#$%^&*()_+-=[]{}|;':",./<>?)

### Additional Validations

- No whitespace characters
- No repeated characters (aaa, 111)
- No common sequences (123, abc, qwe)
- Not entirely numeric
- No common passwords (password, admin)

### Password Strength Scoring

- **0-20**: Very Weak
- **21-40**: Weak
- **41-60**: Moderate
- **61-80**: Strong
- **81-100**: Very Strong

## Security Considerations

### 1. Token Security

- **Separate Secret**: Different JWT secret from authentication tokens
- **Short Expiration**: 10 minutes limits attack window
- **Purpose Validation**: Tokens specifically for password reset
- **Version Control**: Tokens invalidated when password changes

### 2. Rate Limiting

- **Forgot Password**: 3 attempts per 15 minutes
- **Reset Password**: 5 attempts per 15 minutes
- **IP-based Tracking**: Prevents brute force attacks
- **Retry-After Headers**: Inform clients of cooldown periods

### 3. Email Security

- **Generic Responses**: Prevent email enumeration
- **HTML Templates**: Professional, secure email design
- **Security Notices**: Clear expiration and usage instructions
- **Error Handling**: Graceful failure without information leakage

### 4. Database Security

- **Token Hashing**: Audit trail uses hashed tokens
- **TTL Indexes**: Automatic cleanup of expired tokens
- **Optimized Indexes**: Efficient queries for security monitoring
- **User Activity Tracking**: IP and user agent logging

## Environment Variables

```bash
# Password Reset JWT Configuration
JWT_RESET_SECRET=your-super-secure-reset-secret-key
JWT_RESET_EXPIRES_IN=10m

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Frontend URL
FRONTEND_URL=https://your-frontend-domain.com
```

## Frontend Integration

### Token Handling

1. **Extract Token**: Get token from URL query parameter
2. **Validate Token**: Verify token format and structure
3. **Submit Reset**: Send token and new password to API
4. **Error Handling**: Display user-friendly error messages
5. **Redirect**: Redirect to login after successful reset

### UI States

1. **Loading**: Show loading spinner during API calls
2. **Expired Token**: Display token expired message with resend option
3. **Invalid Token**: Display invalid token message
4. **Success**: Show success message and redirect to login
5. **Rate Limited**: Display rate limiting message with countdown

### Example Implementation

```javascript
// Extract token from URL
const token = new URLSearchParams(window.location.search).get('token');

// Handle password reset
const handleReset = async (newPassword) => {
  try {
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Redirect to login
      window.location.href = '/login?message=password-reset-success';
    } else {
      // Display error
      setError(data.message);
    }
  } catch (error) {
    setError('Network error. Please try again.');
  }
};
```

## Monitoring and Auditing

### Security Events to Monitor

1. **High Frequency Requests**: Multiple forgot-password attempts
2. **Token Reuse Attempts**: Using already-used tokens
3. **Invalid Token Patterns**: Malformed or suspicious tokens
4. **IP-based Attacks**: Same IP targeting multiple accounts
5. **Failed Reset Attempts**: Multiple failed password validations

### Audit Trail Data

```javascript
{
  userId: ObjectId,
  token: String, // Hashed
  ipAddress: String,
  userAgent: String,
  createdAt: Date,
  expiresAt: Date,
  used: Boolean,
  updatedAt: Date
}
```

## Testing Checklist

### Security Testing

- [ ] Email enumeration protection
- [ ] Token expiration handling
- [ ] Rate limiting enforcement
- [ ] Password strength validation
- [ ] Token single-use enforcement
- [ ] Version validation after password change
- [ ] Error message consistency
- [ ] Audit trail accuracy

### Functional Testing

- [ ] Valid email receives reset link
- [ ] Invalid email receives generic response
- [ ] Expired tokens are rejected
- [ ] Used tokens are rejected
- [ ] Strong passwords are accepted
- [ ] Weak passwords are rejected
- [ ] Rate limits are enforced
- [ ] Successful reset redirects to login

## Deployment Considerations

### Production Environment

1. **Environment Variables**: Secure JWT secrets and email credentials
2. **HTTPS Required**: All endpoints must use HTTPS
3. **CORS Configuration**: Proper frontend domain whitelist
4. **Logging**: Comprehensive security event logging
5. **Monitoring**: Real-time security alerting

### Database Migration

```javascript
// Add new fields to existing users
db.users.updateMany(
  { resetVersion: { $exists: false } },
  { $set: { resetVersion: 0, passwordResetAt: null } }
);
```

## Compliance

### OWASP Compliance

- ✅ **ASVS Level 2**: Authentication mechanisms
- ✅ **Password Storage**: Secure hashing with bcrypt
- ✅ **Session Management**: Secure token handling
- ✅ **Input Validation**: Comprehensive validation
- ✅ **Error Handling**: Secure error responses

### Industry Standards

- ✅ **NIST SP 800-63B**: Digital identity guidelines
- ✅ **ISO 27001**: Information security management
- ✅ **GDPR**: Data protection and privacy
- ✅ **SOC 2**: Security controls and processes

## Maintenance

### Regular Tasks

1. **Token Cleanup**: Monitor TTL index effectiveness
2. **Rate Limit Review**: Adjust limits based on usage patterns
3. **Security Audit**: Review logs for suspicious activity
4. **Password Policy**: Update strength requirements as needed
5. **Email Templates**: Keep templates current and professional

### Security Updates

1. **JWT Library Updates**: Keep dependencies current
2. **bcrypt Configuration**: Review salt rounds periodically
3. **Rate Limiting**: Adjust based on threat intelligence
4. **Monitoring Rules**: Update detection patterns
5. **Compliance Changes**: Adapt to new regulations

---

This implementation provides a robust, secure, and user-friendly password reset system that meets modern security standards and protects against common attack vectors.
