const Folder = require('../models/folderModel');
const Project = require('../models/projectModel');
const DailyReport = require('../models/dailyReportModel');
const WeeklyReport = require('../models/WeeklyReport');

// @desc    Create a new folder
// @route   POST /api/folders
// @access  Private
exports.createFolder = async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ 
        error: 'Folder name is required' 
      });
    }

    // Check if folder already exists in this company
    const existingFolder = await Folder.findOne({ 
      name: name.trim(), 
      companyId: req.user.companyId,
      isActive: true 
    });
    
    if (existingFolder) {
      return res.status(400).json({ 
        error: 'Folder name already exists'
      });
    }
    
    // Create new folder
    const folder = new Folder({
      name: name.trim(),
      companyId: req.user.companyId,
      createdBy: req.user.userId,
      createdByName: req.user.name || 'Unknown User'
    });
    
    const savedFolder = await folder.save();
    
    res.status(201).json({
      success: true,
      data: savedFolder,
      message: 'Folder created successfully'
    });
    
  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({ 
      error: 'Failed to create folder',
      details: error.message 
    });
  }
};

// @desc    Get all folders with their projects
// @route   GET /api/folders
// @access  Private
exports.getFoldersWithProjects = async (req, res) => {
  try {
    // Get all folders for user's company
    const folders = await Folder.find({ 
      companyId: req.user.companyId,
      isActive: true
    })
    .sort({ updatedAt: -1 })
    .select('-__v');
    
    // Get projects for each folder
    const foldersWithProjects = await Promise.all(
      folders.map(async (folder) => {
        const projects = await Project.find({
          folderId: folder._id,
          companyId: req.user.companyId,
          isActive: true
        })
        .sort({ updatedAt: -1 })
        .select('-__v');

        // Calculate daily report count for folder
        const reportCount = await DailyReport.countDocuments({
          projectName: { $in: projects.map(p => p.name) },
          status: "submitted"
        });

        // Enrich projects with weekly report counts and dates
        const projectsWithWeeklyCounts = await Promise.all(
          projects.map(async (project) => {
            const [weeklyReportCount, lastWeeklyReport] = await Promise.all([
              WeeklyReport.countDocuments({ projectId: project._id, status: "submitted" }),
              WeeklyReport.findOne({ projectId: project._id, status: "submitted" })
                .sort({ updatedAt: -1 })
                .select('updatedAt')
            ]);
            return {
              ...project.toObject(),
              weeklyReportCount,
              lastWeeklyReportDate: lastWeeklyReport?.updatedAt ?? null
            };
          })
        );

        const weeklyReportCount = projectsWithWeeklyCounts.reduce(
          (sum, p) => sum + (p.weeklyReportCount || 0), 0
        );

        const lastWeeklyReportDate = projectsWithWeeklyCounts
          .map(p => p.lastWeeklyReportDate)
          .filter(Boolean)
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;

        return {
          ...folder.toObject(),
          projects: projectsWithWeeklyCounts,
          reportCount: reportCount,
          weeklyReportCount: weeklyReportCount,
          lastWeeklyReportDate: lastWeeklyReportDate
        };
      })
    );

    // Also get projects without folders (root level)
    const rootProjectsRaw = await Project.find({
      $or: [
        { folderId: { $exists: false } },
        { folderId: null }
      ],
      companyId: req.user.companyId,
      isActive: true
    })
    .sort({ updatedAt: -1 })
    .select('-__v');

    const rootProjects = await Promise.all(
      rootProjectsRaw.map(async (project) => {
        const [weeklyReportCount, lastWeeklyReport] = await Promise.all([
          WeeklyReport.countDocuments({ projectId: project._id, status: "submitted" }),
          WeeklyReport.findOne({ projectId: project._id, status: "submitted" })
            .sort({ updatedAt: -1 })
            .select('updatedAt')
        ]);
        return {
          ...project.toObject(),
          weeklyReportCount,
          lastWeeklyReportDate: lastWeeklyReport?.updatedAt ?? null
        };
      })
    );

    res.status(200).json({
      success: true,
      count: foldersWithProjects.length,
      data: foldersWithProjects,
      rootProjects: rootProjects
    });
    
  } catch (error) {
    console.error('Get folders error:', error);
    res.status(500).json({ 
      error: 'Server error retrieving folders' 
    });
  }
};

// @desc    Get all folders (simple list)
// @route   GET /api/folders/list
// @access  Private
exports.getUserFolders = async (req, res) => {
  try {
    const folders = await Folder.find({ 
      companyId: req.user.companyId,
      isActive: true
    })
    .sort({ updatedAt: -1 })
    .select('-__v');
    
    res.status(200).json({
      success: true,
      count: folders.length,
      data: folders
    });
    
  } catch (error) {
    console.error('Get all folders error:', error);
    res.status(500).json({ 
      error: 'Server error retrieving folders' 
    });
  }
};

// @desc    Update a folder
// @route   PUT /api/folders/:id
// @access  Private
exports.updateFolder = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ 
        error: 'Folder name is required' 
      });
    }
    
    // Get current folder
    const currentFolder = await Folder.findOne({ 
      _id: id, 
      companyId: req.user.companyId,
      isActive: true 
    });
    
    if (!currentFolder) {
      return res.status(404).json({ 
        error: 'Folder not found' 
      });
    }
    
    const oldName = currentFolder.name;
    const newName = name.trim();
    
    // Check if new name already exists
    const existingFolder = await Folder.findOne({ 
      name: newName, 
      companyId: req.user.companyId,
      isActive: true,
      _id: { $ne: id }
    });
    
    if (existingFolder) {
      return res.status(400).json({ 
        error: 'Folder name already exists'
      });
    }
    
    // Update folder name
    const folder = await Folder.findOneAndUpdate(
      { _id: id, companyId: req.user.companyId, isActive: true },
      { 
        name: newName,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );
    
    // Update folderName in all projects and reports that belong to this folder
    let projectUpdateResult = null;
    let reportUpdateResult = null;
    if (oldName !== newName) {
      projectUpdateResult = await Project.updateMany(
        { folderId: id },
        { $set: { folderName: newName } }
      );
      
      // Also update folderName in all reports
      reportUpdateResult = await DailyReport.updateMany(
        { folderId: id },
        { $set: { folderName: newName } }
      );
      
      console.log(`Updated ${projectUpdateResult.modifiedCount} projects and ${reportUpdateResult.modifiedCount} reports with new folder name "${newName}"`);
    }
    
    res.status(200).json({
      success: true,
      data: folder,
      message: `Folder updated successfully${oldName !== newName ? ` and ${projectUpdateResult?.modifiedCount || 0} projects, ${reportUpdateResult?.modifiedCount || 0} reports updated` : ''}`
    });
    
  } catch (error) {
    console.error('Update folder error:', error);
    res.status(500).json({ 
      error: 'Server error updating folder' 
    });
  }
};

// @desc    Delete a folder (soft delete)
// @route   DELETE /api/folders/:id
// @access  Private
exports.deleteFolder = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the folder
    const folder = await Folder.findOne({ 
      _id: id, 
      companyId: req.user.companyId,
      isActive: true 
    });
    
    if (!folder) {
      return res.status(404).json({ 
        error: 'Folder not found' 
      });
    }

    // Soft delete the folder
    await Folder.findOneAndUpdate(
      { _id: id },
      { isActive: false }
    );

    // Move all projects in this folder to root level (remove folderId)
    const projectUpdateResult = await Project.updateMany(
      { folderId: id },
      { 
        $set: { 
          folderId: null,
          folderName: ''
        }
      }
    );

    // Also update all reports in this folder to remove folder references
    const reportUpdateResult = await DailyReport.updateMany(
      { folderId: id },
      {
        $set: {
          folderId: null,
          folderName: ''
        }
      }
    );
    
    res.status(200).json({
      success: true,
      message: `Folder deleted successfully. ${projectUpdateResult.modifiedCount} projects and ${reportUpdateResult.modifiedCount} reports moved to root.`
    });
    
  } catch (error) {
    console.error('Delete folder error:', error);
    res.status(500).json({ 
      error: 'Failed to delete folder',
      details: error.message 
    });
  }
};

// @desc    Get master schedule for a folder
// @route   GET /api/folders/:id/master-schedule
// @access  Private
exports.getFolderSchedule = async (req, res) => {
  try {
    const { id } = req.params;

    const folder = await Folder.findOne({
      _id: id,
      companyId: req.user.companyId,
      isActive: true
    }).select('masterSchedule');

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    res.status(200).json({
      success: true,
      data: folder.masterSchedule || []
    });
  } catch (error) {
    console.error('Get folder schedule error:', error);
    res.status(500).json({ error: 'Server error retrieving folder schedule' });
  }
};

// @desc    Update master schedule for a folder
// @route   PATCH /api/folders/:id/master-schedule
// @access  Private
exports.updateFolderSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { masterSchedule } = req.body;

    if (!Array.isArray(masterSchedule)) {
      return res.status(400).json({ error: 'masterSchedule must be an array' });
    }

    const folder = await Folder.findOneAndUpdate(
      { _id: id, companyId: req.user.companyId, isActive: true },
      { $set: { masterSchedule } },
      { new: true, runValidators: true }
    ).select('masterSchedule');

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    res.status(200).json({
      success: true,
      data: folder.masterSchedule
    });
  } catch (error) {
    console.error('Update folder schedule error:', error);
    res.status(500).json({ error: 'Server error updating folder schedule' });
  }
};

// @desc    Get projects in a folder
// @route   GET /api/folders/:id/projects
// @access  Private
exports.getFolderProjects = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify folder exists
    const folder = await Folder.findOne({ 
      _id: id, 
      companyId: req.user.companyId,
      isActive: true 
    });
    
    if (!folder) {
      return res.status(404).json({ 
        error: 'Folder not found' 
      });
    }
    
    const projects = await Project.find({
      folderId: id,
      companyId: req.user.companyId,
      isActive: true
    })
    .sort({ updatedAt: -1 })
    .select('-__v');
    
    res.status(200).json({
      success: true,
      count: projects.length,
      data: projects
    });
    
  } catch (error) {
    console.error('Get folder projects error:', error);
    res.status(500).json({ 
      error: 'Server error retrieving folder projects' 
    });
  }
};
