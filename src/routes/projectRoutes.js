const express = require('express');
const projectController = require('../controllers/projectController');

const router = express.Router();

// Routes are already protected by authenticateToken in app.js
router.post('/', projectController.createProject);
router.get('/', projectController.getUserProjects);
router.put('/:id', projectController.updateProject);
router.put('/:id/move-to-folder', projectController.moveProjectToFolder);
router.delete('/:id', projectController.deleteProject);

module.exports = router;