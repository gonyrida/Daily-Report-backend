const Project = require('../models/projectModel');
const Folder = require('../models/folderModel');
const DailyReport = require('../models/dailyReportModel');

// @desc    Create a new project
// @route   POST /api/projects
// @access  Private
exports.createProject = async (req, res) => {
  try {
    const { name, folderId } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ 
        error: 'Project name is required' 
      });
    }

    // Check if project already exists for this company
    const existingProject = await Project.findOne({ 
      name: name.trim(), 
      companyId: req.user.companyId,
      isActive: true 
    });
    
    if (existingProject) {
      return res.status(400).json({ 
        error: 'Project name already taken'
      });
    }
    
    // If folderId provided, verify it exists
    let folderName = '';
    if (folderId) {
      const folder = await Folder.findOne({
        _id: folderId,
        companyId: req.user.companyId,
        isActive: true
      });
      if (!folder) {
        return res.status(404).json({
          error: 'Folder not found'
        });
      }
      folderName = folder.name;
    }
    
    // Create new project
    const project = new Project({
      name: name.trim(),
      companyId: req.user.companyId,
      createdBy: req.user.userId,
      createdByName: req.user.name || 'Unknown User',
      ...(folderId && { folderId, folderName })
    });
    
    const savedProject = await project.save();
    
    res.status(201).json({
      success: true,
      data: savedProject,
      message: folderId ? `Project created in folder "${folderName}"` : 'Project created successfully'
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
    const { folderId } = req.query;
    
    // Build query
    const query = { 
      companyId: req.user.companyId,
      isActive: true
    };
    
    // If folderId specified, filter by folder
    if (folderId) {
      query.folderId = folderId;
    } else if (folderId === 'null' || folderId === '') {
      // Get root-level projects (no folder)
      query.$or = [{ folderId: { $exists: false } }, { folderId: null }];
    }
    
    const projects = await Project.find(query)
    .sort({ updatedAt: -1 })
    .select('-__v');
    
    // 🚀 NEW: Calculate submitted report count for each project
    const projectsWithSubmittedCount = await Promise.all(
      projects.map(async (project) => {
        const DailyReport = require('../models/dailyReportModel');
        const WeeklyReport = require('../models/WeeklyReport');
        
        const [dailySubmittedCount, weeklySubmittedCount] = await Promise.all([
          DailyReport.countDocuments({
            projectName: project.name,
            status: "submitted"
          }),
          WeeklyReport.countDocuments({
            projectName: project.name,
            status: "submitted"
          })
        ]);
        
        return {
          ...project.toObject(),
          reportCount: dailySubmittedCount + weeklySubmittedCount,  // Count both daily and weekly reports
          weeklyReportCount: weeklySubmittedCount  // Count only weekly reports for Master Report
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

// @desc    Get a single project by ID
// @route   GET /api/projects/:id
// @access  Private
exports.getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const project = await Project.findOne({
      _id: id,
      companyId: req.user.companyId,
      isActive: true
    }).select('-__v');
    
    if (!project) {
      return res.status(404).json({
        error: 'Project not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: project
    });
    
  } catch (error) {
    console.error('Get project by ID error:', error);
    res.status(500).json({ 
      error: 'Server error retrieving project' 
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
      companyId: req.user.companyId,
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
      { _id: id, companyId: req.user.companyId, createdBy: req.user.userId, isActive: true },
      { 
        name: newName,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );
    
    // Update all reports with the old project name
    let dailyUpdateResult = null;
    let weeklyUpdateResult = null;
    let dailyProjectIdUpdateResult = null;
    if (oldName !== newName) {
      const DailyReport = require('../models/dailyReportModel');
      const WeeklyReport = require('../models/WeeklyReport');
      
      // Update Daily Reports - project name
      dailyUpdateResult = await DailyReport.updateMany(
        { 
          projectName: oldName
        },
        { 
          $set: { projectName: newName }
        }
      );
      
      // Also set projectId in reports that don't have it yet
      dailyProjectIdUpdateResult = await DailyReport.updateMany(
        { 
          projectName: newName,
          $or: [
            { projectId: { $exists: false } },
            { projectId: null }
          ]
        },
        { 
          $set: { projectId: id }
        }
      );
      
      // Update Weekly Reports
      weeklyUpdateResult = await WeeklyReport.updateMany(
        { 
          projectName: oldName
        },
        { 
          $set: { 
            projectName: newName,
            'sections.cover.projectName': newName
          }
        }
      );
      
      console.log(`Updated ${dailyUpdateResult.modifiedCount} daily reports from "${oldName}" to "${newName}"`);
      console.log(`Set projectId in ${dailyProjectIdUpdateResult?.modifiedCount || 0} daily reports`);
      console.log(`Updated ${weeklyUpdateResult.modifiedCount} weekly reports from "${oldName}" to "${newName}"`);
    }
    
    res.status(200).json({
      success: true,
      data: project,
      message: `Project updated successfully${oldName !== newName ? ` and ${dailyUpdateResult?.modifiedCount || 0} daily reports and ${weeklyUpdateResult?.modifiedCount || 0} weekly reports updated` : ''}`
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
    const DailyReport = require('../models/dailyReportModel');
    const WeeklyReport = require('../models/WeeklyReport');
    
    const dailyDeleteResult = await DailyReport.deleteMany({ 
      projectName: project.name 
    });
    
    const weeklyDeleteResult = await WeeklyReport.deleteMany({ 
      projectName: project.name 
    });

    console.log(`Deleted ${dailyDeleteResult.deletedCount} daily reports for project "${project.name}"`);
    console.log(`Deleted ${weeklyDeleteResult.deletedCount} weekly reports for project "${project.name}"`);
    
    res.status(200).json({
      success: true,
      message: `Project and ${dailyDeleteResult.deletedCount} daily reports and ${weeklyDeleteResult.deletedCount} weekly reports deleted successfully`
    });
    
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ 
      error: 'Failed to delete project',
      details: error.message 
    });
  }
};

// @desc    Move project to folder
// @route   PUT /api/projects/:id/move-to-folder
// @access  Private
exports.moveProjectToFolder = async (req, res) => {
  try {
    const { id } = req.params;
    const { folderId } = req.body;
    
    // Get current project
    const project = await Project.findOne({ 
      _id: id, 
      companyId: req.user.companyId,
      isActive: true 
    });
    
    if (!project) {
      return res.status(404).json({ 
        error: 'Project not found' 
      });
    }
    
    let folderName = '';
    
    // If folderId provided, verify it exists
    if (folderId) {
      const folder = await Folder.findOne({
        _id: folderId,
        companyId: req.user.companyId,
        isActive: true
      });
      if (!folder) {
        return res.status(404).json({
          error: 'Folder not found'
        });
      }
      folderName = folder.name;
    }
    
    // Update project's folder
    const updatedProject = await Project.findOneAndUpdate(
      { _id: id, companyId: req.user.companyId, isActive: true },
      { 
        folderId: folderId || null,
        folderName: folderName,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );
    
    res.status(200).json({
      success: true,
      data: updatedProject,
      message: folderId 
        ? `Project moved to folder "${folderName}"`
        : 'Project moved to root'
    });
    
  } catch (error) {
    console.error('Move project error:', error);
    res.status(500).json({ 
      error: 'Failed to move project',
      details: error.message 
    });
  }
};