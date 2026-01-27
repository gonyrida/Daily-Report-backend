const feedbackService = require('../services/feedbackService');

const submitFeedback = async (req, res) => {
  try {
    const { rating, message, category, userId, userEmail } = req.body;
    
    console.log('💬 FEEDBACK SUBMISSION:', {
      rating,
      category,
      hasMessage: !!message,
      userId: userId || 'anonymous',
      userEmail: userEmail || 'anonymous',
      timestamp: new Date().toISOString()
    });

    // Validate required fields
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Valid rating (1-5) is required'
      });
    }

    // Create feedback entry
    const feedback = await feedbackService.createFeedback({
      rating: parseInt(rating),
      message: message || '',
      category: category || 'general',
      userId: userId || null,
      userEmail: userEmail || null,
      userAgent: req.body.userAgent,
      url: req.body.url,
      ipAddress: req.ip || req.connection.remoteAddress,
      timestamp: new Date()
    });

    // Send email notification for critical feedback (rating 1-2)
    if (rating <= 2 && message && message.trim().length > 0) {
      try {
        await sendCriticalFeedbackEmail(feedback);
        console.log('✅ Critical feedback email sent');
      } catch (emailError) {
        console.error('❌ Failed to send critical feedback email:', emailError);
        // Continue even if email fails
      }
    }

    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      data: {
        id: feedback.id,
        rating: feedback.rating,
        timestamp: feedback.timestamp
      }
    });

  } catch (error) {
    console.error('❌ Feedback submission failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit feedback',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

const getFeedbackAnalytics = async (req, res) => {
  try {
    // This would be admin-only in production
    const analytics = await feedbackService.getFeedbackAnalytics();
    
    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('❌ Failed to get feedback analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve analytics'
    });
  }
};

const getFeedbackList = async (req, res) => {
  try {
    // This would be admin-only in production
    const { page = 1, limit = 20, rating, category } = req.query;
    
    const feedbackList = await feedbackService.getFeedbackList({
      page: parseInt(page),
      limit: parseInt(limit),
      rating: rating ? parseInt(rating) : undefined,
      category
    });
    
    res.json({
      success: true,
      data: feedbackList
    });

  } catch (error) {
    console.error('❌ Failed to get feedback list:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve feedback list'
    });
  }
};

// Helper function to send email for critical feedback
const sendCriticalFeedbackEmail = async (feedback) => {
  const sendEmail = require('../utils/sendEmail');
  
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Critical Feedback Alert - Rating ${feedback.rating}/5</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .alert { background: #dc3545; color: white; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .details { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0; }
        .rating { font-size: 24px; font-weight: bold; }
        .rating-1 { color: #dc3545; }
        .rating-2 { color: #fd7e14; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="alert">
          <h2>⚠️ Critical Feedback Alert</h2>
          <p>A user has submitted negative feedback that requires immediate attention.</p>
        </div>

        <div class="details">
          <p><strong>Rating:</strong> <span class="rating rating-${feedback.rating}">${feedback.rating}/5</span></p>
          <p><strong>Category:</strong> ${feedback.category}</p>
          <p><strong>Submitted:</strong> ${new Date(feedback.timestamp).toLocaleString()}</p>
          ${feedback.userId ? `<p><strong>User ID:</strong> ${feedback.userId}</p>` : '<p><strong>User:</strong> Anonymous</p>'}
          ${feedback.userEmail ? `<p><strong>Email:</strong> ${feedback.userEmail}</p>` : ''}
        </div>

        ${feedback.message ? `
        <div class="details">
          <h3>Feedback Message:</h3>
          <p>${feedback.message.replace(/\n/g, '<br>')}</p>
        </div>
        ` : ''}

        <div class="details">
          <h3>Technical Details:</h3>
          <p><strong>URL:</strong> ${feedback.url || 'Not available'}</p>
          <p><strong>User Agent:</strong> ${feedback.userAgent || 'Not available'}</p>
          <p><strong>IP Address:</strong> ${feedback.ipAddress || 'Not available'}</p>
        </div>

        <div style="margin-top: 30px; padding: 15px; background: #dc3545; color: white; border-radius: 5px;">
          <p><strong>🚨 Action Required:</strong> Please review this critical feedback and take appropriate action to address the user's concerns.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: process.env.SUPPORT_EMAIL || 'CACPM.Mail@gmail.com',
    subject: `Critical Feedback Alert - Rating ${feedback.rating}/5`,
    html: emailHtml
  });
};

module.exports = {
  submitFeedback,
  getFeedbackAnalytics,
  getFeedbackList
};
