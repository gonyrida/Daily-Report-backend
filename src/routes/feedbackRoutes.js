const express = require('express');
const feedbackController = require('../controllers/feedbackController');
const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();

// POST /api/feedback/submit - Submit feedback (can be anonymous or authenticated)
router.post('/submit', feedbackController.submitFeedback);

// GET /api/feedback/analytics - Get feedback analytics (admin only, for future implementation)
router.get('/analytics', authenticateToken, feedbackController.getFeedbackAnalytics);

// GET /api/feedback/list - Get feedback list (admin only, for future implementation)
router.get('/list', authenticateToken, feedbackController.getFeedbackList);

module.exports = router;
