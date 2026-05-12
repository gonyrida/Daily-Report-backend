const express = require('express');
const folderController = require('../controllers/folderController');

const router = express.Router();

// Routes are already protected by authenticateToken in app.js
router.post('/', folderController.createFolder);
router.get('/', folderController.getFoldersWithProjects);
router.get('/list', folderController.getUserFolders);
router.get('/:id/projects', folderController.getFolderProjects);
router.get('/:id/master-schedule', folderController.getFolderSchedule);
router.patch('/:id/master-schedule', folderController.updateFolderSchedule);
router.put('/:id', folderController.updateFolder);
router.delete('/:id', folderController.deleteFolder);

module.exports = router;
