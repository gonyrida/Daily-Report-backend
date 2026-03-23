const express = require('express');
const router = express.Router();
const constructionProgressController = require('../controllers/constructionProgressController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * Routes for construction progress data
 * Base path: /api/reports/:reportId
 */

// GET /api/reports/:reportId/construction-progress
// Get construction progress data for a specific weekly report
router.get('/construction-progress', constructionProgressController.getConstructionProgress);

// POST /api/reports/:reportId/construction-progress
// Save or update construction progress data for a specific weekly report
router.post('/construction-progress', constructionProgressController.saveConstructionProgress);

// PUT /api/reports/:reportId/construction-progress
// Alternative endpoint for updating construction progress data
router.put('/construction-progress', constructionProgressController.saveConstructionProgress);

// DELETE /api/reports/:reportId/construction-progress
// Delete construction progress data for a specific weekly report
router.delete('/construction-progress', constructionProgressController.deleteConstructionProgress);

module.exports = router;
