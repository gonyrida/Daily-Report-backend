const nodemailer = require('nodemailer');
const User = require('../models/userModel');

class NotificationService {
  constructor() {
    // Configure email transporter
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: process.env.EMAIL_PORT || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  /**
   * Get user notification preferences
   */
  async getUserNotificationPreferences(userId) {
    try {
      const user = await User.findById(userId).select('notificationPreferences email');
      if (!user) {
        throw new Error('User not found');
      }
      return {
        emailNotifications: user.notificationPreferences?.emailNotifications || true,
        autoSave: user.notificationPreferences?.autoSave || true,
        dataSharing: user.notificationPreferences?.dataSharing || false,
        marketingEmails: user.notificationPreferences?.marketingEmails || false,
      };
    } catch (error) {
      console.error('Error getting user notification preferences:', error);
      throw error;
    }
  }

  /**
   * Update user notification preferences
   */
  async updateUserNotificationPreferences(userId, preferences) {
    try {
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { 
          $set: { 
            'notificationPreferences.emailNotifications': preferences.emailNotifications,
            'notificationPreferences.autoSave': preferences.autoSave,
            'notificationPreferences.dataSharing': preferences.dataSharing,
            'notificationPreferences.marketingEmails': preferences.marketingEmails,
          }
        },
        { new: true, upsert: true }
      ).select('notificationPreferences email');

      return updatedUser.notificationPreferences;
    } catch (error) {
      console.error('Error updating user notification preferences:', error);
      throw error;
    }
  }

  /**
   * Send email notification
   */
  async sendEmailNotification(userId, subject, message, type = 'general') {
    try {
      const user = await User.findById(userId).select('email notificationPreferences');
      if (!user) {
        throw new Error('User not found');
      }

      // Check if user has email notifications enabled
      if (!user.notificationPreferences?.emailNotifications) {
        console.log(`Email notifications disabled for user ${userId}`);
        return { success: false, reason: 'Email notifications disabled' };
      }

      // Check marketing emails preference
      if (type === 'marketing' && !user.notificationPreferences?.marketingEmails) {
        console.log(`Marketing emails disabled for user ${userId}`);
        return { success: false, reason: 'Marketing emails disabled' };
      }

      const mailOptions = {
        from: process.env.EMAIL_FROM || '"CACPM Daily Report" <noreply@cacpm.org>',
        to: user.email,
        subject: subject,
        html: this.generateEmailTemplate(message, type),
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info.messageId);
      
      return { 
        success: true, 
        messageId: info.messageId,
        email: user.email
      };
    } catch (error) {
      console.error('Error sending email notification:', error);
      throw error;
    }
  }

  /**
   * Send daily report submission confirmation
   */
  async sendReportSubmissionConfirmation(userId, reportData) {
    const subject = 'Daily Report Submitted Successfully';
    const message = `
      <h2>Daily Report Confirmation</h2>
      <p>Your daily report for <strong>${reportData.projectName}</strong> has been submitted successfully.</p>
      <p><strong>Report Date:</strong> ${new Date(reportData.reportDate).toLocaleDateString()}</p>
      <p><strong>Submitted at:</strong> ${new Date().toLocaleString()}</p>
      <p>Thank you for your submission!</p>
    `;

    return this.sendEmailNotification(userId, subject, message, 'report');
  }

  /**
   * Send weekly report summary
   */
  async sendWeeklyReportSummary(userId, weekData) {
    const subject = 'Weekly Report Summary';
    const message = `
      <h2>Weekly Report Summary</h2>
      <p>Here's your weekly report summary for the week ending ${new Date().toLocaleDateString()}</p>
      <ul>
        <li><strong>Total Reports:</strong> ${weekData.totalReports}</li>
        <li><strong>Projects Worked On:</strong> ${weekData.projectsCount}</li>
        <li><strong>Total Team Members:</strong> ${weekData.totalTeamMembers}</li>
      </ul>
      <p>Great work this week!</p>
    `;

    return this.sendEmailNotification(userId, subject, message, 'weekly');
  }

  /**
   * Send account activity notification
   */
  async sendAccountActivityNotification(userId, activity) {
    const subject = 'Account Activity Alert';
    const message = `
      <h2>Account Activity</h2>
      <p>${activity.message}</p>
      <p><strong>Time:</strong> ${new Date(activity.timestamp).toLocaleString()}</p>
      <p><strong>IP Address:</strong> ${activity.ipAddress}</p>
      <p>If this wasn't you, please secure your account immediately.</p>
    `;

    return this.sendEmailNotification(userId, subject, message, 'security');
  }

  /**
   * Generate HTML email template
   */
  generateEmailTemplate(message, type) {
    const templates = {
      general: {
        header: 'CACPM Daily Report System',
        backgroundColor: '#f8f9fa',
        primaryColor: '#007bff'
      },
      report: {
        header: 'Daily Report Notification',
        backgroundColor: '#e8f5e8',
        primaryColor: '#28a745'
      },
      weekly: {
        header: 'Weekly Report Summary',
        backgroundColor: '#fff3cd',
        primaryColor: '#ffc107'
      },
      marketing: {
        header: 'CACPM Updates',
        backgroundColor: '#d1ecf1',
        primaryColor: '#17a2b8'
      },
      security: {
        header: 'Security Alert',
        backgroundColor: '#f8d7da',
        primaryColor: '#dc3545'
      }
    };

    const template = templates[type] || templates.general;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${template.header}</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: ${template.backgroundColor};
          }
          .header {
            background-color: ${template.primaryColor};
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 5px 5px 0 0;
          }
          .content {
            background-color: white;
            padding: 30px;
            border-radius: 0 0 5px 5px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .footer {
            text-align: center;
            margin-top: 20px;
            padding: 20px;
            font-size: 12px;
            color: #666;
          }
          h1, h2 {
            color: ${template.primaryColor};
            margin-top: 0;
          }
          ul {
            padding-left: 20px;
          }
          li {
            margin-bottom: 10px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${template.header}</h1>
        </div>
        <div class="content">
          ${message}
        </div>
        <div class="footer">
          <p>This is an automated message from the CACPM Daily Report System.</p>
          <p>If you have questions, please contact support.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Test email configuration
   */
  async testEmailConfiguration() {
    try {
      await this.transporter.verify();
      return { success: true, message: 'Email configuration is valid' };
    } catch (error) {
      console.error('Email configuration test failed:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new NotificationService();
