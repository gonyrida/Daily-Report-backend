// src/features/purchase_request/controllers/projectPRController.js
const PR_Project = require("../models/projectPRModel");
const User = require("../../../models/userModel");
const Company = require("../../../models/companyModel");
const mongoose = require('mongoose');

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
      visibility,
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
    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found"
      });
    }

    // Check if project name already exists for this company
    const existingProject = await PR_Project.findOne({
      name,
      companyId: user.companyId
    });

    if (existingProject) {
      return res.status(400).json({
        success: false,
        message: "Project name already exists"
      });
    }

    // Check if project code already exists for this company
    const existingProjectCode = await PR_Project.findOne({
      projectCode,
      companyId: user.companyId
    });

    if (existingProjectCode) {
      return res.status(400).json({
        success: false,
        message: "Project code already exists"
      });
    }

    // Check if sub_project is being created and if it already exists
    if (subProjects && subProjects.length > 0) {
      // Extract only the names from the incoming objects
      const subProjectNames = subProjects.map(sp => sp.name);

      // Search specifically for those names in the subProjects array
      const existingSubProject = await PR_Project.findOne({
        "subProjects.name": { $in: subProjectNames }, // Target the 'name' field inside the array
        companyId: user.companyId
      });

      if (existingSubProject) {
        return res.status(400).json({
          success: false,
          message: "A sub-project with one of these names already exists in another project."
        });
      }
    }

    // Create project
    const project = new PR_Project({
      name,
      projectCode,
      description,
      status: status || 'active',
      requestDate: requestDate || new Date(),
      visibility: visibility || 'private',
      counter: 0,
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
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const companyId = new mongoose.Types.ObjectId(req.user.companyId);
    const { page = 1, limit = 10, status, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Base Match: Filter by Company and Status
    let matchStage = { companyId: companyId };

    // 2. Add Status if it exists
    if (status) {
      matchStage.status = status;
    }

    // 3. Add Permissions AND Search using a guaranteed $and array
    let criteria = [];

    // Permission Criteria
    if (req.user.role === 'user') {
      criteria.push({
        $or: [
          { visibility: 'public' },
          { "members._id": userId }
        ]
      });
    }

    // Search Criteria
    if (search) {
      criteria.push({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { projectCode: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ]
      });
    }

    // 4. Finalize the matchStage
    if (criteria.length > 0) {
      matchStage.$and = criteria;
    }

    // 5. Start the pipeline
    let pipeline = [{ $match: matchStage }];

    if (req.user.role === 'user') {
      /** * USER ROLE: Flatten and filter specific subProjects
       */
      pipeline.push(
        {
          $project: {
            _id: 1,
            name: 1,
            createdAt: 1,
            projectCode: "$projectCode",
            // We only keep purposes as they are
            purposes: {
              $map: {
                input: "$purposes",
                as: "purp",
                in: {
                  _id: "$$purp._id",
                  name: "$$purp.name"
                }
              }
            },
            // Filter the subProjects array directly in the DB
            subProjects: {
              $let: {
                vars: {
                  // First, perform the filter as you did before
                  filtered: {
                    $filter: {
                      input: { $ifNull: ["$subProjects", []] },
                      as: "sub",
                      cond: {
                        $or: [
                          { $eq: [search || "", ""] }, 
                          { $regexMatch: { input: "$$sub.name", regex: search || "", options: "i" } }
                        ]
                      }
                    }
                  }
                },
                in: {
                  $cond: {
                    // IF the filtered array is empty AND there is no active search
                    // (Usually, you only want to auto-fill if the user isn't actively searching for something else)
                    if: { $eq: [{ $size: "$$filtered" }, 0] },
                    then: [
                      { 
                        _id: "$_id", 
                        name: "$projectCode" // Your requirement: ID from project, name from projectCode
                      }
                    ],
                    else: "$$filtered"
                  }
                }
              }
            }
          }
        }
      );
    } else {
      /** * ADMIN/APPROVER ROLE: Keep project documents intact
       */
      pipeline.push(
        {
          $lookup: {
            from: "users", // Adjust if your collection name is different
            localField: "createdBy",
            foreignField: "_id",
            pipeline: [
              { 
                $project: { 
                  firstName: 1,
                  lastName: 1,
                }
              }
            ],
            as: "createdBy"
          }
        },
        { $unwind: { path: "$createdBy", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            name: 1,
            createdAt: 1,
            projectCode: 1,
            subProjects: {
              $cond: {
                if: { 
                  $or: [
                    { $eq: ["$subProjects", []] }, 
                    { $eq: [{ $ifNull: ["$subProjects", "missing"] }, "missing"] }
                  ]
                },
                then: [{ _id: "$_id", name: "$projectCode" }],
                else: "$subProjects"
              }
            },
            purposes: 1,
            createdBy: "$createdBy",
            status: 1
          }
        }
      );
    }

    // 3. Shared Pagination and Sorting
    pipeline.push(
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [{ $skip: skip }, { $limit: parseInt(limit) }]
        }
      }
    );

    const result = await PR_Project.aggregate(pipeline);
    const data = result[0].data;
    const total = result[0].metadata[0]?.total || 0;

    res.status(200).json({
      success: true,
      data: data, // Now consistently formatted based on role
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("Aggregation Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
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

    if (user.role !== 'admin' && user.role !== 'approver') {
      return res.status(403).json({
        success: false,
        message: "User is not authorized to view specific projects"
      });
    }

    // Get company information
    const company = await Company.findById(req.user.companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found"
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

    if (user.role !== 'admin' && user.role !== 'approver') {
      return res.status(403).json({
        success: false,
        message: "User is not authorized to update specific projects"
      });
    }

    if (user._id.toString() !== project.createdBy.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this project"
      });
    }

    // Get company information
    const company = await Company.findById(req.user.companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found"
      });
    }

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found"
      });
    }

    // Check if project name is being changed and if it already exists
    if (name && name !== project.name) {
      const existingProject = await PR_Project.findOne({
        name,
        companyId: user.companyId,
        _id: { $ne: req.params.id }
      });

      if (existingProject) {
        return res.status(400).json({
          success: false,
          message: "Project name already exists"
        });
      }
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

    // Check if sub_project is being changed and if it already exists
    if (subProjects && subProjects.length > 0) {
      // 1. Extract only the names from the incoming objects
      const subProjectNames = subProjects.map(sp => sp.name);

      // 2. Search specifically for those names in the subProjects array
      const existingSubProject = await PR_Project.findOne({
        "subProjects.name": { $in: subProjectNames }, // Target the 'name' field inside the array
        companyId: user.companyId,
        _id: { $ne: req.params.id } // Exclude the current document
      });

      if (existingSubProject) {
        return res.status(400).json({
          success: false,
          message: "A sub-project with one of these names already exists in another project."
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


    if (user.role !== 'admin' && user.role !== 'approver') {
      return res.status(403).json({
        success: false,
        message: "User is not authorized to delete specific projects"
      });
    }


    if (user._id.toString() !== project.createdBy.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this project"
      });
    }

    // Get company information
    const company = await Company.findById(req.user.companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found"
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
  // try {
  //   const user = await User.findById(req.user.userId);
  //   if (!user) {
  //     return res.status(404).json({
  //       success: false,
  //       message: "User not found"
  //     });
  //   }

  //   const { q } = req.query;

  //   if (!q || q.length < 2) {
  //     return res.status(400).json({
  //       success: false,
  //       message: "Search query must be at least 2 characters"
  //     });
  //   }

  //   // Search users in the same company
  //   const users = await User.find({
  //     companyId: user.companyId,
  //     isActive: true,
  //     $or: [
  //       { firstName: { $regex: q, $options: 'i' } },
  //       { lastName: { $regex: q, $options: 'i' } },
  //       { email: { $regex: q, $options: 'i' } },
  //       { department: { $regex: q, $options: 'i' } }
  //     ]
  //   }).select('firstName lastName email department role position _id').limit(20);

  //   res.status(200).json({
  //     success: true,
  //     data: users
  //   });

  // } catch (error) {
  //   console.error("Search users error:", error);
  //   res.status(500).json({
  //     success: false,
  //     message: "Server error searching users"
  //   });
  // }
};