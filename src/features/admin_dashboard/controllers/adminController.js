// src/features/admin_dashboard/controllers/adminController.js
const User = require("../../../models/userModel");

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
    const skip = (page - 1) * limit;
 
    // Use the requesting admin's companyId automatically
    const filter = { companyId: requestingUser.companyId };
 
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