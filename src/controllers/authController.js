const sendEmail = require("../utils/sendEmail");

const User = require("../models/userModel");

const PasswordReset = require("../models/passwordResetModel");

const TokenBlacklist = require("../models/tokenBlacklistModel");

const generateToken = require("../utils/generateToken");

const {
  generatePasswordResetToken,
  verifyPasswordResetToken,
  isTokenVersionValid,
} = require("../utils/generateResetToken");

const { validatePasswordStrength } = require("../utils/passwordValidator");
const { generateEmailVerificationToken, verifyEmailToken } = require("../utils/generateEmailVerificationToken");
const { getEmailVerificationTemplate } = require("../utils/emailTemplates");
const crypto = require("crypto");
const env = require("../config/env");

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public

exports.register = async (req, res) => {
  console.log("📥 Registration attempt:", {
    email: req.body.email,
    fullName: req.body.fullName,
    hasPassword: !!req.body.password,
  });

  try {
    const { email, password, fullName } = req.body;

    // Validation
    if (!email || !password || !fullName || fullName.trim().length === 0) {
      console.log("❌ Validation failed: Missing fields");
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Split fullName into firstName and lastName
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log("❌ Validation failed: Invalid email format");
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    // Validate email domain - only allow @cambodiacpm.com
    const allowedDomain = "cambodiacpm.com";
    const emailDomain = email.toLowerCase().split('@')[1];
    if (emailDomain !== allowedDomain) {
      console.log("❌ Validation failed: Unauthorized email domain:", emailDomain);
      return res.status(403).json({
        success: false,
        message: `Registration is only allowed for company email addresses`,
      });
    }

    // Check password length
    if (password.length < 8) {
      console.log("❌ Validation failed: Password too short");
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    console.log("✅ Validation passed, checking for existing user...");

    // Check existing user
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      console.log("❌ User already exists:", email);
      return res.status(409).json({
        success: false,
        message: "Email already in use",
      });
    }

    console.log("✅ No existing user, creating new user...");

    // Create user
    const userData = {
      email: email.toLowerCase(),
      password,
      firstName,
      lastName,
    };

     // Assign companyId based on verified email domain
    // companyId is never accepted from request body for security
    let assignedCompanyId = null;
    
    // Only assign companyId for verified email domains (already validated above)
    if (emailDomain === allowedDomain) {
      // Production: Assign verified company ID for CACPM domain
      assignedCompanyId = "6975e43e400dcc89c6f92463"; // Verified CACPM company ID
      console.log("✅ Assigned verified company ID for domain:", emailDomain);
    } else {
      console.log("❌ Security error: Unauthorized domain passed validation:", emailDomain);
      return res.status(500).json({
        success: false,
        message: "Server configuration error - domain validation failed",
      });
    }
    
    // Development mode: Allow test companyId override for testing
    if (process.env.NODE_ENV === "development" && process.env.DEV_TEST_COMPANY_ID) {
      assignedCompanyId = process.env.DEV_TEST_COMPANY_ID;
      console.log("🔧 DEV MODE: Overridden with test company ID:", assignedCompanyId);
    }
    
    // Final validation: Ensure companyId is assigned
    if (!assignedCompanyId) {
      console.log("❌ Security error: No companyId assigned for domain:", emailDomain);
      return res.status(500).json({
        success: false,
        message: "Server configuration error - unable to assign company",
      });
    }
    
    userData.companyId = assignedCompanyId;
    console.log("🏢 Final assigned company ID:", assignedCompanyId);

    const user = new User(userData);

    // Generate email verification token
    const { token: verificationToken, expires: verificationExpires } = generateEmailVerificationToken();
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = verificationExpires;

    console.log("💾 Saving user to database...");
    await user.save();
    console.log("✅ User saved successfully");

    // Send verification email
    try {
      console.log("📧 Preparing to send verification email...");
      console.log("📧 Email config check:", {
        host: process.env.EMAIL_HOST,
        user: process.env.EMAIL_USER,
        passExists: !!process.env.EMAIL_PASS,
        to: email
      });
      
      // Use different URLs for development vs production
      // Force development for now - change this logic later
      const isDevelopment = true; // process.env.NODE_ENV === 'development';
      console.log("🔍 NODE_ENV check:", {
        NODE_ENV: process.env.NODE_ENV,
        isDevelopment: isDevelopment,
        type: typeof process.env.NODE_ENV
      });
      const baseUrl = isDevelopment 
        ? (process.env.FRONTEND_URL || 'http://localhost:8080')
        : (process.env.PRODUCTION_URL || 'https://a.cambodiacpm.com');
      
      const verificationLink = `${baseUrl}/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;
      const emailHtml = getEmailVerificationTemplate(firstName, verificationLink);
      
      console.log("📧 Sending email with link:", verificationLink);
      console.log("🌐 Environment:", isDevelopment ? 'development' : 'production');
      
      await sendEmail({
        to: email,
        subject: 'Verify Your Email Address - CACPM Daily Report System',
        html: emailHtml
      });
      
      console.log("✅ Verification email sent successfully");
    } catch (emailError) {
      console.error("❌ Failed to send verification email:", emailError);
      console.error("❌ Email error details:", {
        message: emailError.message,
        code: emailError.code,
        stack: emailError.stack
      });
      // Don't fail registration if email fails, but log it
    }

    console.log("🔑 Generating token...");

    // Generate token
    const token = generateToken(user);
    console.log("✅ Token generated");

    console.log("✅ Registration successful for:", email);

    // Set JWT cookie
    const { setTokenCookie } = require("../middleware/authMiddleware");
    setTokenCookie(res, token);

    res.status(201).json({
      success: true,
      message: "Account created successfully. Please check your email to verify your account.",
      token, // Include JWT token for frontend Python API access
      user: user.toJSON(),
      emailVerificationRequired: !user.emailVerified,
    });
  } catch (error) {
    console.error("❌❌❌ Register error:", error);
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);

    res.status(500).json({
      success: false,
      message: "Server error during registration",
      error: error.message, // Temporarily show error for debugging
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    // This is commented out for testing purposes
    // Make sure to uncomment it before deploy and 
    // remove if (!email) { when you uncomment if (!email || !password) {
    // if (!email || !password) {
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Find user and include password for comparison
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password"
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account has been deactivated",
      });
    }

    // Check if email is verified
    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email address before logging in. Check your inbox for the verification email.",
        emailVerificationRequired: true,
      });
    }

    // This is commented out for testing purposes
    // Make sure to uncomment it before deploy
    // Compare password
    // const isPasswordValid = await user.comparePassword(password);
    // if (!isPasswordValid) {
    //   return res.status(401).json({
    //     success: false,
    //     message: "Invalid credentials",
    //   });
    // }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const token = generateToken(user);

    // Create login session for tracking
    try {
      const loginHistory = require("../services/loginHistoryService");
      await loginHistory.createLoginSession(user._id.toString(), req, token);
      console.log("🔐 Login session created for user:", user.email);
    } catch (sessionError) {
      console.error("⚠️ Failed to create login session:", sessionError);
      // Continue with login even if session tracking fails
    }

    // Set HTTP-only cookie with the token
    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("token", token, {
      httpOnly: true, // Prevents JavaScript access (XSS protection)
      secure: isProduction, // HTTPS only in production
      sameSite: isProduction ? "None" : "strict", // "None" for cross-site on Render
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: "/",
      domain: ".cambodiacpm.com",  // This is the key!
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: user.toJSON(),
      token: token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during login",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private

exports.logout = async (req, res) => {
  try {
    // Deactivate the current session
    try {
      const loginHistory = require("../services/loginHistoryService");
      const token =
        req.cookies.token || req.headers.authorization?.replace("Bearer ", "");

      if (token) {
        await loginHistory.deactivateSession(token);
        console.log("🚪 Session deactivated on logout");
      }
    } catch (sessionError) {
      console.error("⚠️ Failed to deactivate session:", sessionError);
      // Continue with logout even if session deactivation fails
    }

    // Clear the authentication cookie
    const isProduction = process.env.NODE_ENV === "production";
    res.clearCookie("token", {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "strict",
      path: "/",
      // Don't set domain for Render subdomains
    });

    res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during logout",
    });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Return user data in the format expected by frontend
    res.status(200).json({
      success: true,
      user: user.toJSON(),
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error retrieving profile",
    });
  }
};

// @route   PUT /api/auth/profile
// @access  Private

exports.updateProfile = async (req, res) => {
  try {
    const { fullName, email, profilePicture } = req.body;

    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update fullName if provided
    if (fullName !== undefined) {
      user.fullName = fullName;

      // Also update firstName and lastName for compatibility
      const nameParts = fullName.trim().split(/\s+/);
      user.firstName = nameParts[0] || user.firstName;
      user.lastName = nameParts.slice(1).join(" ") || user.lastName;
    }

    // Update email if provided (with validation)
    if (email !== undefined && email !== user.email) {
      // Check if email is already in use by another user
      const existingUser = await User.findOne({
        email: email.toLowerCase(),
        _id: { $ne: user._id },
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Email is already in use by another account",
        });
      }

      user.email = email.toLowerCase();
    }

    // Update profilePicture if provided
    if (profilePicture !== undefined) {
      user.profilePicture = profilePicture;
    }

    await user.save();

    // Return updated user data in the format expected by frontend
    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        accountStatus: user.accountStatus,
        profilePicture: user.profilePicture,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating profile",
    });
  }
};

// @desc    Change password

// @route   PUT /api/auth/change-password

// @access  Private

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validation

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,

        message: "Current password and new password are required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,

        message: "New password must be at least 8 characters",
      });
    }

    // Find user with password

    const user = await User.findById(req.user.userId).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,

        message: "User not found",
      });
    }

    // Verify current password

    const isPasswordValid = await user.comparePassword(currentPassword);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,

        message: "Current password is incorrect",
      });
    }

    // Update password

    user.password = newPassword;

    await user.save();

    res.status(200).json({
      success: true,

      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);

    res.status(500).json({
      success: false,

      message: "Server error changing password",
    });
  }
};

// @desc    Request password reset

// @route   POST /api/auth/forgot-password

// @access  Public

exports.forgotPassword = async (req, res) => {
  try {
    console.log("🚀 forgotPassword called", { email: req.body.email });

    const { email } = req.body;

    if (!email) {
      console.log("⚠️ No email provided in request body");

      return res.status(400).json({
        success: false,

        message: "Email is required",
      });
    }

    // Validate email format

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,

        message: "Invalid email format",
      });
    }

    // Find user (but don't reveal if exists or not)

    const user = await User.findOne({ email: email.toLowerCase() });

    console.log("🔍 User lookup completed for:", email.toLowerCase());

    // Always return the same response regardless of whether user exists

    const responseMessage = "If that email exists, a reset link has been sent";

    if (user && user.isActive) {
      try {
        // Generate JWT reset token

        const resetToken = generatePasswordResetToken(user);

        console.log("🔑 Generated JWT reset token for user:", user._id);

        // Store token reference in database for audit trail

        await PasswordReset.create({
          userId: user._id,

          token: crypto.createHash("sha256").update(resetToken).digest("hex"),

          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes

          used: false,
        });

        // Prepare reset URL

        const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`;

        console.log("🔗 Reset URL generated");

        // Send email

        const htmlTemplate = `

          <!DOCTYPE html>

          <html lang="en">

          <head>

            <meta charset="UTF-8">

            <meta name="viewport" content="width=device-width, initial-scale=1.0">

            <title>Password Reset - CACPM</title>

            <style>

              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }

              .header { background-color: #007bff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }

              .content { background-color: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px; }

              .button { display: inline-block; background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }

              .footer { font-size: 12px; color: #666; text-align: center; margin-top: 20px; }

              .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 5px; margin: 10px 0; }

            </style>

          </head>

          <body>

            <div class="header">

              <h1>CACPM Password Reset</h1>

            </div>

            <div class="content">

              <p>Hello,</p>

              <p>You have requested to reset your password for your CACPM account.</p>

              <p>Please click the button below to reset your password:</p>

              <a href="${resetUrl}" class="button">Reset Password</a>

              <p>If the button doesn't work, copy and paste this link into your browser:</p>

              <p><a href="${resetUrl}">${resetUrl}</a></p>

              <div class="warning">

                <p><strong>⚠️ Security Notice:</strong></p>

                <ul>

                  <li>This link will expire in 10 minutes for security reasons</li>

                  <li>You can only use this link once</li>

                  <li>If you didn't request this password reset, please ignore this email</li>

                </ul>

              </div>

            </div>

            <div class="footer">

              <p>&copy; 2024 CACPM. All rights reserved.</p>

            </div>

          </body>

          </html>

        `;

        await sendEmail({
          to: user.email,

          subject: "Password Reset Request - CACPM",

          html: htmlTemplate,
        });

        console.log(
          "✅ Password reset email sent successfully to:",
          user.email,
        );
      } catch (emailError) {
        console.error("❌ Failed to send password reset email:", emailError);

        // Still return generic message to avoid revealing user existence
      }
    }

    res.status(200).json({
      success: true,

      message: responseMessage,
    });
  } catch (error) {
    console.error("❌ Forgot password error:", error);

    res.status(500).json({
      success: false,

      message: "Server error processing password reset request",
    });
  }
};

// @desc    Reset password

// @route   POST /api/auth/reset-password

// @access  Public

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    console.log("🚀 resetPassword called", { tokenLength: token?.length });

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,

        message: "Reset token and new password are required",
      });
    }

    // Validate password strength

    const passwordValidation = validatePasswordStrength(newPassword);

    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,

        message: "Password does not meet security requirements",

        errors: passwordValidation.errors,
      });
    }

    let decodedToken;

    try {
      decodedToken = verifyPasswordResetToken(token);

      console.log("✅ Token verified for user:", decodedToken.userId);
    } catch (tokenError) {
      console.log("❌ Token verification failed:", tokenError.message);

      return res.status(400).json({
        success: false,

        message: tokenError.message,
      });
    }

    // Find user

    const user = await User.findById(decodedToken.userId);

    if (!user) {
      console.log("❌ User not found for token:", decodedToken.userId);

      return res.status(404).json({
        success: false,

        message: "User not found",
      });
    }

    // Check if user account is active

    if (!user.isActive) {
      console.log("❌ Inactive user attempted password reset:", user.email);

      return res.status(403).json({
        success: false,

        message: "Account has been deactivated",
      });
    }

    // Validate token version against user's current reset version

    if (!isTokenVersionValid(decodedToken, user)) {
      console.log("❌ Token version mismatch for user:", user._id);

      return res.status(400).json({
        success: false,

        message: "Invalid or expired reset token",
      });
    }

    // Check if token has been used before

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const existingResetRecord = await PasswordReset.findOne({
      userId: user._id,

      token: tokenHash,

      used: true,
    });

    if (existingResetRecord) {
      console.log("❌ Attempted reuse of already used token");

      return res.status(400).json({
        success: false,

        message: "Reset token has already been used",
      });
    }

    // Update user password (this will automatically increment resetVersion)

    user.password = newPassword;

    await user.save();

    console.log("✅ Password updated successfully for user:", user._id);

    // Mark token as used in database

    await PasswordReset.updateOne(
      { userId: user._id, token: tokenHash },

      { used: true },
    );

    // Clean up any other unused reset tokens for this user

    await PasswordReset.deleteMany({
      userId: user._id,

      used: false,
    });

    console.log(
      "✅ Password reset completed successfully for user:",
      user.email,
    );

    res.status(200).json({
      success: true,

      message:
        "Password reset successful. Please login with your new password.",
    });
  } catch (error) {
    console.error("❌ Reset password error:", error);

    res.status(500).json({
      success: false,

      message: "Server error resetting password",
    });
  }
};

// @desc    Test email sending

// @route   POST /api/auth/test-email

// @access  Public (for testing purposes)

exports.testEmail = async (req, res) => {
  try {
    const { to } = req.body;

    if (!to) {
      return res.status(400).json({
        success: false,

        message: "Recipient email is required",
      });
    }

    const testHtml = `

      <!DOCTYPE html>

      <html lang="en">

      <head>

        <meta charset="UTF-8">

        <meta name="viewport" content="width=device-width, initial-scale=1.0">

        <title>Test Email - CACPM</title>

        <style>

          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }

          .header { background-color: #17a2b8; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }

          .content { background-color: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px; }

          .footer { font-size: 12px; color: #666; text-align: center; margin-top: 20px; }

        </style>

      </head>

      <body>

        <div class="header">

          <h1>CACPM Test Email</h1>

        </div>

        <div class="content">

          <p>Hello,</p>

          <p>This is a test email from CACPM to verify email functionality.</p>

          <p>If you received this email, the email configuration is working correctly!</p>

          <p>Timestamp: ${new Date().toISOString()}</p>

        </div>

        <div class="footer">

          <p>&copy; 2024 CACPM. All rights reserved.</p>

        </div>

      </body>

      </html>

    `;

    await sendEmail({
      to,

      subject: "Test Email - CACPM",

      html: testHtml,
    });

    console.log("Test email sent successfully to:", to);

    res.status(200).json({
      success: true,

      message: "Test email sent successfully",
    });
  } catch (error) {
    console.error("Test email error:", error);

    res.status(500).json({
      success: false,

      message: "Failed to send test email",

      error: error.message,
    });
  }
};

// @desc    Verify token

// @route   GET /api/auth/verify

// @access  Private

exports.verifyToken = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,

        message: "Invalid token",
      });
    }

    res.status(200).json({
      success: true,

      message: "Token is valid",

      user: user.toJSON(),
    });
  } catch (error) {
    console.error("Verify token error:", error);

    res.status(500).json({
      success: false,

      message: "Server error verifying token",
    });
  }
};

// @desc    Get user login history

// @route   GET /api/auth/login-history

// @access  Private

exports.getLoginHistory = async (req, res) => {
  try {
    const userId = req.user.userId;

    const page = parseInt(req.query.page) || 1;

    const limit = parseInt(req.query.limit) || 10;

    console.log("📋 Login history request:", { userId, page, limit });

    // Get login history from service

    const loginHistory = require("../services/loginHistoryService");

    const result = await loginHistory.getUserLoginHistory(userId, page, limit);

    res.status(200).json({
      success: true,

      data: result.sessions,

      pagination: result.pagination,
    });
  } catch (error) {
    console.error("❌ Get login history error:", error);

    res.status(500).json({
      success: false,

      message: "Failed to retrieve login history",
    });
  }
};

// @desc    Revoke a specific session

// @route   POST /api/auth/revoke-session/:sessionId

// @access  Private

exports.revokeSession = async (req, res) => {
  try {
    const userId = req.user.userId;

    const { sessionId } = req.params;

    console.log("🚫 Revoke session request:", { userId, sessionId });

    const loginHistory = require("../services/loginHistoryService");

    await loginHistory.revokeSession(userId, sessionId);

    res.status(200).json({
      success: true,

      message: "Session revoked successfully",
    });
  } catch (error) {
    console.error("❌ Revoke session error:", error);

    res.status(500).json({
      success: false,

      message: "Failed to revoke session",
    });
  }
};

// @desc    Revoke all other sessions

// @route   POST /api/auth/revoke-all-sessions

// @access  Private

exports.revokeAllSessions = async (req, res) => {
  try {
    const userId = req.user.userId;

    const currentToken = req.token; // Current session token

    console.log("🚫 Revoke all sessions request:", { userId });

    const loginHistory = require("../services/loginHistoryService");

    await loginHistory.revokeAllOtherSessions(userId, currentToken);

    res.status(200).json({
      success: true,

      message: "All other sessions revoked successfully",
    });
  } catch (error) {
    console.error("❌ Revoke all sessions error:", error);

    res.status(500).json({
      success: false,

      message: "Failed to revoke sessions",
    });
  }
};

// @desc    Deactivate user account

// @route   POST /api/auth/deactivate-account

// @access  Private

exports.deactivateAccount = async (req, res) => {
  try {
    const { password } = req.body;

    const userId = req.user.userId;

    console.log("🔄 Account deactivation request:", { userId });

    // Validate password

    if (!password) {
      return res.status(400).json({
        success: false,

        message: "Password is required for account deactivation",
      });
    }

    // Find user and verify password

    const user = await User.findById(userId).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,

        message: "User not found",
      });
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,

        message: "Current password is incorrect",
      });
    }

    // Deactivate account

    user.isActive = false;

    user.deactivatedAt = new Date();

    user.deactivationReason = "user_request";

    await user.save();

    // Revoke all sessions

    try {
      const loginHistory = require("../services/loginHistoryService");

      await loginHistory.revokeAllOtherSessions(userId, null);
    } catch (sessionError) {
      console.error(
        "⚠️ Failed to revoke sessions during deactivation:",
        sessionError,
      );
    }

    // Log action for audit

    console.log("🔄 Account deactivated:", {
      userId,

      email: user.email,

      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,

      message: "Account deactivated successfully",
    });
  } catch (error) {
    console.error("❌ Account deactivation error:", error);

    res.status(500).json({
      success: false,

      message: "Failed to deactivate account",
    });
  }
};

// @desc    Delete user account

// @route   DELETE /api/auth/delete-account

// @access  Private

exports.deleteAccount = async (req, res) => {
  try {
    const { password, confirmation } = req.body;

    const userId = req.user.userId;

    console.log("🗑️ Account deletion request:", { userId });

    // Validate inputs

    if (!password) {
      return res.status(400).json({
        success: false,

        message: "Password is required for account deletion",
      });
    }

    // Find user and verify password

    const user = await User.findById(userId).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,

        message: "User not found",
      });
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,

        message: "Current password is incorrect",
      });
    }

    // Additional security check - confirmation text

    const expectedConfirmation = `DELETE ${user.email}`;

    if (confirmation !== expectedConfirmation) {
      return res.status(400).json({
        success: false,

        message: "Invalid confirmation text",
      });
    }

    // Soft delete - mark as deleted but keep data for audit

    user.isDeleted = true;

    user.deletedAt = new Date();

    user.deletionReason = "user_request";

    user.isActive = false;

    await user.save();

    // Revoke all sessions

    try {
      const loginHistory = require("../services/loginHistoryService");

      await loginHistory.revokeAllOtherSessions(userId, null);
    } catch (sessionError) {
      console.error(
        "⚠️ Failed to revoke sessions during deletion:",
        sessionError,
      );
    }

    // Log action for audit

    console.log("🗑️ Account deleted:", {
      userId,

      email: user.email,

      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,

      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("❌ Account deletion error:", error);

    res.status(500).json({
      success: false,

      message: "Failed to delete account",
    });
  }
};

// @desc    Verify email address
// @route   GET /api/auth/verify-email
// @access  Public
exports.verifyEmail = async (req, res) => {
  try {
    const { token, email } = req.query;

    if (!token || !email) {
      return res.status(400).json({
        success: false,
        message: "Verification token and email are required",
      });
    }

    // Find user by email and include verification fields
    const user = await User.findOne({ 
      email: email.toLowerCase() 
    }).select('+emailVerificationToken +emailVerificationExpires');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify the token
    const tokenVerification = verifyEmailToken(user, token);
    
    if (!tokenVerification.valid) {
      return res.status(400).json({
        success: false,
        message: tokenVerification.message,
      });
    }

    // Mark email as verified and clear verification fields
    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    console.log("✅ Email verified successfully for:", email);

    res.status(200).json({
      success: true,
      message: "Email verified successfully! Your account is now active.",
    });

  } catch (error) {
    console.error("❌ Email verification error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during email verification",
    });
  }
};

// @desc    Resend verification email
// @route   POST /api/auth/resend-verification
// @access  Public
exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified",
      });
    }

    // Generate new verification token
    const { token: verificationToken, expires: verificationExpires } = generateEmailVerificationToken();
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = verificationExpires;
    await user.save();

    // Send verification email
    try {
      const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;
      const emailHtml = getEmailVerificationTemplate(user.firstName, verificationLink);
      
      await sendEmail({
        to: email,
        subject: 'Verify Your Email Address - CACPM Daily Report System',
        html: emailHtml
      });
      
      console.log("✅ Verification email resent successfully");
    } catch (emailError) {
      console.error("❌ Failed to resend verification email:", emailError);
      return res.status(500).json({
        success: false,
        message: "Failed to send verification email",
      });
    }

    res.status(200).json({
      success: true,
      message: "Verification email sent successfully. Please check your inbox.",
    });

  } catch (error) {
    console.error("❌ Resend verification error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while resending verification email",
    });
  }
};
