// src/features/purchase_request/controllers/projectPRController.js
const PR_Project = require("../models/projectPRModel");
const User = require("../../../models/userModel");
const Company = require("../../../models/companyModel");

// @desc    Create new project
// @route   POST /api/purchase-requests/projects
// @access  Private
exports.createPRProject = async (req, res) => {
  try {
    const {
      name,
      projectCode,
      description,
      status,
      requestDate,
      subProjects,
      budgetSettings,
      purposes,
      members,
      visibility
    } = req.body;

    // Validation
    if (!name || !projectCode) {
      return res.status(400).json({
        success: false,
        message: "Project name and project code are required"
      });
    }

    // Get user information
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (user.role !== 'admin' && user.role !== 'approver') {
      return res.status(403).json({
        success: false,
        message: "User is not authorized to create projects"
      });
    }

    console.log("This is req.user: ", req.user);
    console.log("This is req.user.companyId: ", req.user.companyId);

    // Get company information
    const company = await Company.findById(req.user.companyId);

    console.log("This is company: ", company);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found"
      });
    }

    // Check if project code already exists for this company
    const existingProject = await PR_Project.findOne({
      projectCode,
      companyId: user.companyId
    });

    if (existingProject) {
      return res.status(400).json({
        success: false,
        message: "Project code already exists"
      });
    }

    // Create project
    const project = new PR_Project({
      name,
      projectCode,
      description,
      status: status || 'active',
      requestDate: requestDate || new Date(),
      visibility: visibility || 'private',
      subProjects: subProjects || [],
      budgetSettings: {
        MBOQ: parseFloat(budgetSettings?.MBOQ) || 0,
        DMBOQ: parseFloat(budgetSettings?.DMBOQ) || 0,
        percentage: parseFloat(budgetSettings?.percentage) || 0
      },
      purposes: purposes || [],
      members: members || [],
      
      createdBy: user._id,
      companyId: user.companyId
    });

    await project.save();

    // Populate user details for response
    await project.populate('createdBy', 'firstName lastName email');

    res.status(201).json({
      success: true,
      message: "Project created successfully",
      data: project
    });

  } catch (error) {
    console.error("Create project error:", error);
    res.status(500).json({
      success: false,
      message: "Server error creating project",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get all projects for a user/company
// @route   GET /api/purchase-requests/projects
// @access  Private
exports.getPRProjects = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const { page = 1, limit = 10, status, search } = req.query;
    const skip = (page - 1) * limit;

    // Build query
    let query = {
      companyId: user.companyId
    };

    // Filter by status if provided
    if (status) {
      query.status = status;
    }

    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { projectCode: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const projects = await PR_Project.find(query)
      // .select('name projectCode status createdAt')
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await PR_Project.countDocuments(query);

    res.status(200).json({
      success: true,
      data: projects,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("Get projects error:", error);
    res.status(500).json({
      success: false,
      message: "Server error retrieving projects"
    });
  }
};

// @desc    Get single project by ID
// @route   GET /api/purchase-requests/projects/:id
// @access  Private
exports.getPRProjectById = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const project = await PR_Project.findOne({
      _id: req.params.id,
      companyId: user.companyId
    }).populate('createdBy', 'firstName lastName email');

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found"
      });
    }

    res.status(200).json({
      success: true,
      data: project
    });

  } catch (error) {
    console.error("Get project by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Server error retrieving project"
    });
  }
};

// @desc    Update project
// @route   PUT /api/purchase-requests/projects/:id
// @access  Private
exports.updatePRProject = async (req, res) => {
  try {
    const {
      name,
      projectCode,
      description,
      status,
      requestDate,
      subProjects,
      budgetSettings,
      purposes,
      members,
      visibility
    } = req.body;

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const project = await PR_Project.findOne({
      _id: req.params.id,
      companyId: user.companyId
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found"
      });
    }

    if (user._id.toString() !== project.createdBy.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this project"
      });
    }

    // Check if project code is being changed and if it already exists
    if (projectCode && projectCode !== project.projectCode) {
      const existingProject = await PR_Project.findOne({
        projectCode,
        companyId: user.companyId,
        _id: { $ne: req.params.id }
      });

      if (existingProject) {
        return res.status(400).json({
          success: false,
          message: "Project code already exists"
        });
      }
    }

    // Update fields
    if (name) project.name = name;
    if (projectCode) project.projectCode = projectCode;
    if (description !== undefined) project.description = description;
    if (status) project.status = status;
    if (requestDate) project.requestDate = requestDate;
    if (subProjects) project.subProjects = subProjects;
    if (budgetSettings) {
      project.budgetSettings = {
        MBOQ: parseFloat(budgetSettings.MBOQ) || 0,
        DMBOQ: parseFloat(budgetSettings.DMBOQ) || 0,
        percentage: parseFloat(budgetSettings.percentage) || 0
      };
    }
    if (purposes) project.purposes = purposes;
    if (members) project.members = members;
    if (visibility) project.visibility = visibility;

    project.updatedAt = new Date();

    await project.save();

    res.status(200).json({
      success: true,
      message: "Project updated successfully",
      data: project
    });

  } catch (error) {
    console.error("Update project error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating project"
    });
  }
};

// @desc    Delete project
// @route   DELETE /api/purchase-requests/projects/:id
// @access  Private
exports.deletePRProject = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const project = await PR_Project.findOne({
      _id: req.params.id,
      companyId: user.companyId
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found"
      });
    }

    await PR_Project.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Project deleted successfully"
    });

  } catch (error) {
    console.error("Delete project error:", error);
    res.status(500).json({
      success: false,
      message: "Server error deleting project"
    });
  }
};

// @desc    Search users for member invitation
// @route   GET /api/purchase-requests/projects/search-users
// @access  Private
exports.searchUsers = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters"
      });
    }

    // Search users in the same company
    const users = await User.find({
      companyId: user.companyId,
      isActive: true,
      $or: [
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { department: { $regex: q, $options: 'i' } }
      ]
    }).select('firstName lastName email department role position _id').limit(20);

    res.status(200).json({
      success: true,
      data: users
    });

  } catch (error) {
    console.error("Search users error:", error);
    res.status(500).json({
      success: false,
      message: "Server error searching users"
    });
  }
};