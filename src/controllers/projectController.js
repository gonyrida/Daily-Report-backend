const Project = require('../models/projectModel');
const DailyReport = require('../models/dailyReportModel');

// @desc    Create a new project
// @route   POST /api/projects
// @access  Private
exports.createProject = async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ 
        error: 'Project name is required' 
      });
    }

    // Check if project already exists for ANY user (global unique)
    const existingProject = await Project.findOne({ 
      name: name.trim(), 
      isActive: true 
    });
    
    if (existingProject) {
      return res.status(400).json({ 
        error: 'Project name already taken by another user'
      });
    }
    
    // Create new project
    const project = new Project({
      name: name.trim(),
      companyId: req.user.companyId,  // ← ADD THIS
      createdBy: req.user.userId,
      createdByName: req.user.name || 'Unknown User'
    });
    
    const savedProject = await project.save();
    
    res.status(201).json({
      success: true,
      data: savedProject,
      message: 'Project created successfully'
    });
    
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ 
      error: 'Failed to create project',
      details: error.message 
    });
  }
};

// @desc    Get all projects for a user
// @route   GET /api/projects
// @access  Private
exports.getUserProjects = async (req, res) => {
  try {
    const projects = await Project.find({ 
      companyId: req.user.companyId,  // ← ADD THIS FILTER
      isActive: true
    })
    .sort({ updatedAt: -1 })
    .select('-__v');
    
    // 🚀 NEW: Calculate submitted report count for each project
    const projectsWithSubmittedCount = await Promise.all(
      projects.map(async (project) => {
        const submittedCount = await DailyReport.countDocuments({
          projectName: project.name,
          status: "submitted"
        });
        
        return {
          ...project.toObject(),
          reportCount: submittedCount  // ← Override with submitted count
        };
      })
    );
    
    res.status(200).json({
      success: true,
      count: projectsWithSubmittedCount.length,
      data: projectsWithSubmittedCount
    });
    
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ 
      error: 'Server error retrieving projects' 
    });
  }
};

// @desc    Update a project
// @route   PUT /api/projects/:id
// @access  Private
exports.updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ 
        error: 'Project name is required' 
      });
    }
    
    // Get current project to get old name
    const currentProject = await Project.findOne({ 
      _id: id, 
      companyId: req.user.companyId,  // ← ADD THIS
      createdBy: req.user.userId, 
      isActive: true 
    });
    
    if (!currentProject) {
      return res.status(404).json({ 
        error: 'Project not found' 
      });
    }
    
    const oldName = currentProject.name;
    const newName = name.trim();
    
    // Check if new name already exists
    const existingProject = await Project.findOne({ 
      name: newName, 
      isActive: true,
      _id: { $ne: id }
    });
    
    if (existingProject) {
      return res.status(400).json({ 
        error: 'Project name already taken by another user'
      });
    }
    
    // Update project name
    const project = await Project.findOneAndUpdate(
      { _id: id, companyId: req.user.companyId, createdBy: req.user.userId, isActive: true },  // ← ADD companyId
      { 
        name: newName,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );
    
    // 🚀 NEW: Update all reports with the old project name
    let updateResult = null;
    if (oldName !== newName) {
      const DailyReport = require('../models/dailyReportModel');
      
      const updateResult = await DailyReport.updateMany(
        { 
          projectName: oldName  // ← Remove userId filter to update ALL users' reports
        },
        { 
          $set: { projectName: newName }
        }
      );
      
      console.log(`Updated ${updateResult.modifiedCount} reports from "${oldName}" to "${newName}"`);
    }
    
    res.status(200).json({
      success: true,
      data: project,
      message: `Project updated successfully${oldName !== newName ? ` and ${updateResult?.modifiedCount || 0} reports updated` : ''}`
    });
    
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ 
      error: 'Server error updating project' 
    });
  }
};

// @desc    Delete a project (soft delete)
// @route   DELETE /api/projects/:id
// @access  Private
exports.deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find and delete the project
    const project = await Project.findOneAndDelete(
      { _id: id, companyId: req.user.companyId, createdBy: req.user.userId, isActive: true }  // ← ADD companyId
    );
    
    if (!project) {
      return res.status(404).json({ 
        error: 'Project not found' 
      });
    }

    // Delete all reports associated with this project
    const deleteResult = await DailyReport.deleteMany({ 
      projectName: project.name 
    });

    console.log(`Deleted ${deleteResult.deletedCount} reports for project "${project.name}"`);
    
    res.status(200).json({
      success: true,
      message: `Project and ${deleteResult.deletedCount} reports deleted successfully`
    });
    
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ 
      error: 'Failed to delete project',
      details: error.message 
    });
  }
};