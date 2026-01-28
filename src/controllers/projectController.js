const Project = require('../models/projectModel');

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
      isActive: true  // ← Remove createdBy filter for company-wide access
    })
    .sort({ updatedAt: -1 })
    .select('-__v'); // Exclude version field
    
    res.status(200).json({
      success: true,
      count: projects.length,
      data: projects
    });
    
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch projects',
      details: error.message 
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
    
    // Check if new name already exists for ANY user (excluding current project)
    const existingProject = await Project.findOne({ 
      name: name.trim(), 
      isActive: true,
      _id: { $ne: id } // Exclude current project
    });
    
    if (existingProject) {
      return res.status(400).json({ 
        error: 'Project name already taken by another user'
      });
    }
    
    const project = await Project.findOneAndUpdate(
      { _id: id, createdBy: req.user.userId, isActive: true },
      { 
        name: name.trim(),
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );
    
    if (!project) {
      return res.status(404).json({ 
        error: 'Project not found' 
      });
    }
    
    res.status(200).json({
      success: true,
      data: project,
      message: 'Project updated successfully'
    });
    
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ 
      error: 'Failed to update project',
      details: error.message 
    });
  }
};

// @desc    Delete a project (soft delete)
// @route   DELETE /api/projects/:id
// @access  Private
exports.deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    
    const project = await Project.findOneAndUpdate(
      { _id: id, createdBy: req.user.userId, isActive: true },
      { 
        isActive: false,
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!project) {
      return res.status(404).json({ 
        error: 'Project not found' 
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Project deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ 
      error: 'Failed to delete project',
      details: error.message 
    });
  }
};