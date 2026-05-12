// src/features/admin_dashboard/controllers/adminController.js
const User = require("../../../models/userModel");
const sendEmail = require("../../../utils/sendEmail");
const { getEmailVerificationTemplate } = require("../../../utils/emailTemplates");
const { generatePasswordResetToken } = require("../../../utils/generateResetToken");
const { generateSecurePassword } = require("../utils/generateSecurePassword");

// @desc    Get recent users (admin only)
// @route   GET /api/admin/recent-users
// @access  Admin
exports.getRecentUsers = async (req, res) => {
  try {
    const requestingUser = await User.findById(req.user.userId);
    if (!requestingUser || requestingUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Admin access required"
      });
    }

    const users = await User.find({})
      .select('-password')
      .sort({ lastLogin: -1 })
      .limit(5);

    res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error("Get recent users error:", error);
    res.status(500).json({
      success: false,
      message: "Server error retrieving recent users"
    });
  }
};

// @desc    Get all users (admin only)
// @route   GET /api/admin/all-users
// @access  Admin
exports.getAllUsers = async (req, res) => {
  try {
    const requestingUser = await User.findById(req.user.userId);
    if (!requestingUser || requestingUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Admin access required"
      });
    }
 
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    //Extract filters from query parameters
    const { role, search } = req.query;
 
    // Use the requesting admin's companyId automatically
    const filter = { companyId: requestingUser.companyId };

    if (role && role !== "all") {
      filter.role = role;
    }

    // Future Optimization Tips: Either use MongoDB Atlas Search (Lucene) or Create text indexes 
    if (search) {
      // Use $or to check multiple fields
      // Split search into keywords for more flexible matching
      const keywords = search.split(" ").filter(Boolean);
      
      filter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        // Advanced: Check if keywords match either field
        { firstName: { $in: keywords.map(k => new RegExp(k, 'i')) } },
        { lastName: { $in: keywords.map(k => new RegExp(k, 'i')) } }
      ];
    }
 
    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
 
    const total = await User.countDocuments(filter);
 
    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({
      success: false,
      message: "Server error retrieving users"
    });
  }
};

// @desc    Create a new user (admin only)
// @route   POST /api/admin/users
// @access  Admin
exports.createUser = async (req, res) => {
  try {
    const { firstName, lastName, email, role, position, department, orgLevel } = req.body;
    const requestingUser = await User.findById(req.user.userId);
    
    if (!requestingUser || requestingUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Admin access required"
      });
    }

    const generatedPassword = generateSecurePassword();
 
    const newUser = await User.create({
      firstName,
      lastName,
      email,
      password: generatedPassword, // Use generated password
      role: role || 'user',
      position,
      department,
      orgLevel,
      companyId: requestingUser.companyId,
      emailVerified: true,
      isActive: true,
      resetVersion: 1
    });
 
    // Generate reset token for password setup
    const resetToken = generatePasswordResetToken(newUser);

    // Calculate expiration time (1 hour from now)
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    
    // Update with token data (single additional save)
    await User.updateOne(
      { _id: newUser._id },
      { 
        passwordResetToken: resetToken,
        passwordResetExpires: expires
      }
    );

    // Reset Link
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? (process.env.PRODUCTION_URL || 'https://daily-report-frontend.officemuckup.com')
      : (process.env.FRONTEND_URL || 'http://localhost:8080');
    const resetLink = `${baseUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(newUser.email)}`;
 
    // Send welcome email with reset link
    await sendEmail({
      to: newUser.email,
      subject: "Welcome to CACPM - Verify Your Email",
      html: getEmailVerificationTemplate(newUser.firstName, resetLink)
    });
 
    res.status(201).json({
      success: true,
      message: "User created successfully. Welcome email with setup instructions sent.",
      data: {
        ...newUser.toJSON(),
        requiresPasswordSetup: true // Don't return the generated password for security
      }
    });
 
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error creating user"
    });
  }
};

// @desc    Update user (admin only)
// @route   PUT /api/admin/users/:id
// @access  Admin
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, role, position, department, password, orgLevel } = req.body;
    
    const requestingUser = await User.findById(req.user.userId);
    
    if (!requestingUser || requestingUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Admin access required"
      });
    }

    // Find user to update
    const userToUpdate = await User.findById(id);
    
    if (!userToUpdate) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Ensure admin can only update users in their company
    if (userToUpdate.companyId.toString() !== requestingUser.companyId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access denied - user belongs to different company"
      });
    }

    // TODO: Future update. find ways to update user without doing both update and password update
    // Update user fields
    const updatedUser = await User.findByIdAndUpdate(
      id,
      {
        firstName,
        lastName,
        email,
        role: role || userToUpdate.role,
        position: position || userToUpdate.position,
        department: department || userToUpdate.department,
        orgLevel: orgLevel !== undefined ? orgLevel : userToUpdate.orgLevel
      },
      { new: true, runValidators: true }
    );

    // Update password if exist
    if (password) {
      updatedUser.password = password;
      await updatedUser.save();
    }

    res.status(200).json({
      success: true,
      message: "User updated successfully",
    });

  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating user"
    });
  }
};