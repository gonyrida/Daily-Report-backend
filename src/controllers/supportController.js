const supportService = require('../services/supportService');
const sendEmail = require('../utils/sendEmail');

const submitSupportRequest = async (req, res) => {
  try {
    const { subject, category, message, priority } = req.body;
    const userId = req.user.userId;
    const attachment = req.file;

    console.log('🎫 SUPPORT REQUEST:', {
      userId,
      subject,
      category,
      priority,
      hasAttachment: !!attachment,
      timestamp: new Date().toISOString()
    });

    // Validate required fields
    if (!subject || !category || !message) {
      return res.status(400).json({
        success: false,
        message: 'Subject, category, and message are required'
      });
    }

    // Create support ticket
    const ticket = await supportService.createSupportTicket({
      userId,
      subject,
      category,
      message,
      priority: priority || 'medium',
      attachment: attachment ? {
        filename: attachment.filename,
        originalName: attachment.originalname,
        path: attachment.path,
        size: attachment.size,
        mimetype: attachment.mimetype
      } : null
    });

    // Send email notification to support team
    try {
      await sendSupportEmail(ticket, req.user);
      console.log('✅ Support email sent successfully');
    } catch (emailError) {
      console.error('❌ Failed to send support email:', emailError);
      // Continue even if email fails - ticket is still created
    }

    // Send confirmation email to user
    try {
      await sendConfirmationEmail(ticket, req.user);
      console.log('✅ Confirmation email sent to user');
    } catch (emailError) {
      console.error('❌ Failed to send confirmation email:', emailError);
      // Continue even if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Support request submitted successfully',
      data: {
        ticketId: ticket.ticketId,
        status: ticket.status,
        createdAt: ticket.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Support request submission failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit support request',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

const getUserTickets = async (req, res) => {
  try {
    const userId = req.user.userId;
    const tickets = await supportService.getUserTickets(userId);

    res.json({
      success: true,
      data: tickets
    });

  } catch (error) {
    console.error('❌ Failed to get user tickets:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve tickets'
    });
  }
};

const getTicketDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    
    const ticket = await supportService.getTicketById(id, userId);
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    res.json({
      success: true,
      data: ticket
    });

  } catch (error) {
    console.error('❌ Failed to get ticket details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve ticket details'
    });
  }
};

// Helper function to send support email to the support team
const sendSupportEmail = async (ticket, user) => {
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Support Request - ${ticket.ticketId}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .priority { padding: 4px 8px; border-radius: 3px; color: white; font-size: 12px; }
        .priority-high { background: #dc3545; }
        .priority-medium { background: #ffc107; color: #000; }
        .priority-low { background: #28a745; }
        .priority-critical { background: #6f42c1; }
        .details { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0; }
        .attachment { background: #e9ecef; padding: 10px; border-radius: 5px; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>🎫 New Support Request</h2>
          <p><strong>Ticket ID:</strong> ${ticket.ticketId}</p>
          <p><strong>Submitted:</strong> ${new Date(ticket.createdAt).toLocaleString()}</p>
        </div>

        <div class="details">
          <p><strong>From:</strong> ${user.fullName} (${user.email})</p>
          <p><strong>Category:</strong> ${ticket.category}</p>
          <p><strong>Priority:</strong> <span class="priority priority-${ticket.priority}">${ticket.priority.toUpperCase()}</span></p>
          <p><strong>Subject:</strong> ${ticket.subject}</p>
        </div>

        <div class="details">
          <h3>Message:</h3>
          <p>${ticket.message.replace(/\n/g, '<br>')}</p>
        </div>

        ${ticket.attachment ? `
        <div class="attachment">
          <h4>📎 Attachment:</h4>
          <p><strong>File:</strong> ${ticket.attachment.originalName}</p>
          <p><strong>Size:</strong> ${(ticket.attachment.size / 1024).toFixed(1)} KB</p>
          <p><strong>Type:</strong> ${ticket.attachment.mimetype}</p>
        </div>
        ` : ''}

        <div style="margin-top: 30px; padding: 15px; background: #007bff; color: white; border-radius: 5px;">
          <p><strong>🚨 Action Required:</strong> Please review and respond to this support request within the expected timeframe.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: process.env.SUPPORT_EMAIL || 'support@cacpm.org',
    subject: `New Support Request - ${ticket.ticketId} - ${ticket.subject}`,
    html: emailHtml
  });
};

// Helper function to send confirmation email to user
const sendConfirmationEmail = async (ticket, user) => {
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Support Request Received - ${ticket.ticketId}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #28a745; color: white; padding: 20px; border-radius: 5px; margin-bottom: 20px; text-align: center; }
        .details { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0; }
        .footer { background: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 20px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Support Request Received</h1>
          <p>Your support request has been successfully submitted</p>
        </div>

        <div class="details">
          <h3>Request Details:</h3>
          <p><strong>Ticket ID:</strong> ${ticket.ticketId}</p>
          <p><strong>Category:</strong> ${ticket.category}</p>
          <p><strong>Priority:</strong> ${ticket.priority}</p>
          <p><strong>Subject:</strong> ${ticket.subject}</p>
          <p><strong>Submitted:</strong> ${new Date(ticket.createdAt).toLocaleString()}</p>
        </div>

        <div class="details">
          <h3>What happens next?</h3>
          <p>Our support team has received your request and will review it shortly. You can expect a response within:</p>
          <ul>
            <li><strong>Critical:</strong> 1-2 hours</li>
            <li><strong>High:</strong> 4-6 hours</li>
            <li><strong>Medium:</strong> 12-24 hours</li>
            <li><strong>Low:</strong> 24-48 hours</li>
          </ul>
        </div>

        <div class="footer">
          <p>Please reference ticket ID <strong>${ticket.ticketId}</strong> in all future communications.</p>
          <p>If you need to add more information, simply submit another request mentioning this ticket ID.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: user.email,
    subject: `Support Request Received - ${ticket.ticketId}`,
    html: emailHtml
  });
};

module.exports = {
  submitSupportRequest,
  getUserTickets,
  getTicketDetails
};
