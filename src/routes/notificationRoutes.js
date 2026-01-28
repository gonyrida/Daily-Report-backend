const express = require('express');
const router = express.Router();
const notificationService = require('../services/notificationService');
const { authenticateToken } = require('../middleware/authMiddleware');

// Get user notification preferences
router.get('/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const preferences = await notificationService.getUserNotificationPreferences(userId);
    
    res.json({
      success: true,
      data: preferences
    });
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification preferences',
      error: error.message
    });
  }
});

// Update user notification preferences
router.put('/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { emailNotifications, autoSave, dataSharing, marketingEmails } = req.body;

    // Validate input
    const preferences = {
      emailNotifications: emailNotifications !== undefined ? Boolean(emailNotifications) : undefined,
      autoSave: autoSave !== undefined ? Boolean(autoSave) : undefined,
      dataSharing: dataSharing !== undefined ? Boolean(dataSharing) : undefined,
      marketingEmails: marketingEmails !== undefined ? Boolean(marketingEmails) : undefined,
    };

    // Remove undefined values
    Object.keys(preferences).forEach(key => {
      if (preferences[key] === undefined) {
        delete preferences[key];
      }
    });

    const updatedPreferences = await notificationService.updateUserNotificationPreferences(userId, preferences);
    
    res.json({
      success: true,
      message: 'Notification preferences updated successfully',
      data: updatedPreferences
    });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notification preferences',
      error: error.message
    });
  }
});

// Send test email notification
router.post('/test-email', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const result = await notificationService.sendEmailNotification(
      userId,
      'Test Email Notification',
      `
        <h2>Test Email</h2>
        <p>This is a test email to verify that your email notifications are working correctly.</p>
        <p>If you received this email, your notification settings are configured properly.</p>
        <p>Best regards,<br>CACPM Daily Report Team</p>
      `,
      'general'
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'Test email sent successfully',
        data: {
          messageId: result.messageId,
          email: result.email
        }
      });
    } else {
      res.json({
        success: false,
        message: result.reason || 'Failed to send test email'
      });
    }
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test email',
      error: error.message
    });
  }
});

// Test email configuration (admin only)
router.post('/test-configuration', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin (you might want to add admin role checking)
    const result = await notificationService.testEmailConfiguration();
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Email configuration test failed',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error testing email configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test email configuration',
      error: error.message
    });
  }
});

module.exports = router;
