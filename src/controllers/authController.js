const sendEmail = require("../utils/sendEmail");
const User = require("../models/userModel");
const PasswordReset = require("../models/passwordResetModel");
const generateToken = require("../utils/generateToken");
const { generatePasswordResetToken, verifyPasswordResetToken, isTokenVersionValid } = require("../utils/generateResetToken");
const { validatePasswordStrength } = require("../utils/passwordValidator");
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
    const user = new User({
      email: email.toLowerCase(),
      password,
      firstName,
      lastName,
    });

    console.log("💾 Saving user to database...");
    await user.save();
    console.log("✅ User saved successfully");

    console.log("🔑 Generating token...");
    // Generate token
    const token = generateToken(user);
    console.log("✅ Token generated");

    console.log("✅ Registration successful for:", email);
    res.status(201).json({
      success: true,
      message: "Account created successfully",
      token,
      user: user.toJSON(),
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
    if (!email || !password) {
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

    // Compare password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user);

    // Set HTTP-only cookie with the token
    res.cookie("token", token, {
      httpOnly: true, // Prevents JavaScript access (XSS protection)
      secure: process.env.NODE_ENV === "production", // HTTPS only in production
      sameSite: "strict", // CSRF protection
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: user.toJSON(),
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

// @desc    Logout user (optional - mainly for client-side token removal)
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res) => {
  try {
    // Clear the authentication cookie
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
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

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName } = req.body;
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: user.toJSON(),
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
        console.log("✅ Password reset email sent successfully to:", user.email);
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
      { used: true }
    );

    // Clean up any other unused reset tokens for this user
    await PasswordReset.deleteMany({
      userId: user._id,
      used: false,
    });

    console.log("✅ Password reset completed successfully for user:", user.email);

    res.status(200).json({
      success: true,
      message: "Password reset successful. Please login with your new password.",
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
