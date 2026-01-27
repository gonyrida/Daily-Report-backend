const User = require('../models/userModel');
const DailyReport = require('../models/dailyReportModel');
const fs = require('fs');
const path = require('path');

// Configuration
const RETENTION_PERIODS = {
  DELETED_ACCOUNTS: 30, // days - keep deleted accounts for 30 days before permanent deletion
  DEACTIVATED_ACCOUNTS: 90, // days - keep deactivated accounts for 90 days before cleanup
  LOGIN_SESSIONS: 7, // days - keep login sessions for 7 days
  FEEDBACK: 365, // days - keep feedback data for 1 year
  SUPPORT_TICKETS: 730, // days - keep support tickets for 2 years
};

// Scheduled cleanup service
const DataCleanupService = {
  // Main cleanup function - called by scheduler
  async performScheduledCleanup() {
    console.log('🧹 Starting scheduled data cleanup...');
    
    const startTime = Date.now();
    const results = {
      deletedAccounts: 0,
      deactivatedAccounts: 0,
      loginSessions: 0,
      feedback: 0,
      supportTickets: 0,
      filesDeleted: 0,
      errors: []
    };

    try {
      // 1. Permanently delete old deleted accounts
      const deletedAccountsResult = await this.permanentlyDeleteOldDeletedAccounts();
      results.deletedAccounts = deletedAccountsResult.deleted;
      results.errors.push(...deletedAccountsResult.errors);

      // 2. Cleanup old deactivated accounts
      const deactivatedAccountsResult = await this.cleanupOldDeactivatedAccounts();
      results.deactivatedAccounts = deactivatedAccountsResult.deleted;
      results.errors.push(...deactivatedAccountsResult.errors);

      // 3. Cleanup old login sessions
      const loginSessionsResult = await this.cleanupOldLoginSessions();
      results.loginSessions = loginSessionsResult.deleted;
      results.errors.push(...loginSessionsResult.errors);

      // 4. Cleanup old feedback data
      const feedbackResult = await this.cleanupOldFeedback();
      results.feedback = feedbackResult.deleted;
      results.errors.push(...feedbackResult.errors);

      // 5. Cleanup old support tickets
      const supportTicketsResult = await this.cleanupOldSupportTickets();
      results.supportTickets = supportTicketsResult.deleted;
      results.errors.push(...supportTicketsResult.errors);

      // 6. Cleanup orphaned files
      const filesResult = await this.cleanupOrphanedFiles();
      results.filesDeleted = filesResult.deleted;
      results.errors.push(...filesResult.errors);

    } catch (error) {
      console.error('❌ Critical error during cleanup:', error);
      results.errors.push(`Critical cleanup error: ${error.message}`);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log('🧹 Scheduled cleanup completed:', {
      duration: `${duration}ms`,
      results
    });

    // Log summary for monitoring
    this.logCleanupSummary(results);

    return results;
  },

  // Permanently delete accounts marked as deleted after retention period
  async permanentlyDeleteOldDeletedAccounts() {
    const result = { deleted: 0, errors: [] };
    
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - RETENTION_PERIODS.DELETED_ACCOUNTS);

      console.log(`🗑️ Finding accounts deleted before: ${cutoffDate.toISOString()}`);

      // Find accounts marked as deleted older than retention period
      const accountsToDelete = await User.find({
        isDeleted: true,
        deletedAt: { $lt: cutoffDate }
      });

      console.log(`📋 Found ${accountsToDelete.length} accounts for permanent deletion`);

      for (const account of accountsToDelete) {
        try {
          // Delete all associated data
          await this.deleteAllUserData(account._id, account.email);
          
          // Permanently delete the user account
          await User.findByIdAndDelete(account._id);
          
          result.deleted++;
          console.log(`🗑️ Permanently deleted account: ${account.email}`);
          
        } catch (error) {
          const errorMsg = `Failed to delete account ${account.email}: ${error.message}`;
          result.errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      }

    } catch (error) {
      result.errors.push(`Error finding deleted accounts: ${error.message}`);
    }

    return result;
  },

  // Cleanup very old deactivated accounts (optional - can be reactivated)
  async cleanupOldDeactivatedAccounts() {
    const result = { deleted: 0, errors: [] };
    
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - RETENTION_PERIODS.DEACTIVATED_ACCOUNTS);

      console.log(`🔄 Finding accounts deactivated before: ${cutoffDate.toISOString()}`);

      // Find very old deactivated accounts
      const oldDeactivatedAccounts = await User.find({
        isActive: false,
        deactivatedAt: { $lt: cutoffDate },
        isDeleted: { $ne: true }
      });

      console.log(`📋 Found ${oldDeactivatedAccounts.length} old deactivated accounts`);

      for (const account of oldDeactivatedAccounts) {
        try {
          // Option 1: Permanently delete very old deactivated accounts
          await this.deleteAllUserData(account._id, account.email);
          await User.findByIdAndDelete(account._id);
          
          result.deleted++;
          console.log(`🗑️ Permanently deleted old deactivated account: ${account.email}`);
          
        } catch (error) {
          const errorMsg = `Failed to cleanup deactivated account ${account.email}: ${error.message}`;
          result.errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      }

    } catch (error) {
      result.errors.push(`Error finding deactivated accounts: ${error.message}`);
    }

    return result;
  },

  // Delete all user data including reports, files, etc.
  async deleteAllUserData(userId, userEmail) {
    console.log(`🗑️ Deleting all data for user: ${userEmail}`);

    try {
      // 1. Delete daily reports
      const reportResult = await DailyReport.deleteMany({ userId });
      console.log(`📊 Deleted ${reportResult.deletedCount} daily reports`);

      // 2. Delete user files from uploads directory
      await this.deleteUserFiles(userId, userEmail);

      // 3. Delete any other user-related data (add more as needed)
      // - Feedback, support tickets, etc. would be handled by their respective cleanup functions

    } catch (error) {
      console.error(`❌ Error deleting user data for ${userEmail}:`, error);
      throw error;
    }
  },

  // Delete user's uploaded files
  async deleteUserFiles(userId, userEmail) {
    const uploadsDir = path.join(__dirname, '../../uploads');
    let filesDeleted = 0;

    try {
      // Delete from images directory
      const imagesDir = path.join(uploadsDir, 'images', userId);
      if (fs.existsSync(imagesDir)) {
        const files = fs.readdirSync(imagesDir);
        for (const file of files) {
          const filePath = path.join(imagesDir, file);
          fs.unlinkSync(filePath);
          filesDeleted++;
        }
        fs.rmdirSync(imagesDir);
        console.log(`📁 Deleted ${filesDeleted} files from images directory`);
      }

      // Delete from support attachments (if any)
      const supportDir = path.join(uploadsDir, 'support');
      if (fs.existsSync(supportDir)) {
        const files = fs.readdirSync(supportDir);
        for (const file of files) {
          // Check if file belongs to this user (you might need a better way to track this)
          if (file.includes(userId) || file.includes(userEmail)) {
            const filePath = path.join(supportDir, file);
            fs.unlinkSync(filePath);
            filesDeleted++;
          }
        }
        console.log(`📁 Deleted ${filesDeleted} files from support directory`);
      }

    } catch (error) {
      console.error(`❌ Error deleting user files:`, error);
      throw error;
    }

    return filesDeleted;
  },

  // Cleanup old login sessions (from in-memory storage)
  async cleanupOldLoginSessions() {
    const result = { deleted: 0, errors: [] };
    
    try {
      const loginHistory = require('./loginHistoryService');
      const deleted = await loginHistory.cleanupOldSessions(RETENTION_PERIODS.LOGIN_SESSIONS);
      result.deleted = deleted;
      
      console.log(`🔐 Cleaned up ${deleted} old login sessions`);
      
    } catch (error) {
      result.errors.push(`Error cleaning login sessions: ${error.message}`);
    }

    return result;
  },

  // Cleanup old feedback data
  async cleanupOldFeedback() {
    const result = { deleted: 0, errors: [] };
    
    try {
      const feedbackService = require('./feedbackService');
      const deleted = await feedbackService.deleteOldFeedback(RETENTION_PERIODS.FEEDBACK);
      result.deleted = deleted;
      
      console.log(`💬 Cleaned up ${deleted} old feedback entries`);
      
    } catch (error) {
      result.errors.push(`Error cleaning feedback: ${error.message}`);
    }

    return result;
  },

  // Cleanup old support tickets
  async cleanupOldSupportTickets() {
    const result = { deleted: 0, errors: [] };
    
    try {
      const supportService = require('./supportService');
      const deleted = await supportService.deleteOldSupportTickets(RETENTION_PERIODS.SUPPORT_TICKETS);
      result.deleted = deleted;
      
      console.log(`🎫 Cleaned up ${deleted} old support tickets`);
      
    } catch (error) {
      result.errors.push(`Error cleaning support tickets: ${error.message}`);
    }

    return result;
  },

  // Cleanup orphaned files (files without corresponding database records)
  async cleanupOrphanedFiles() {
    const result = { deleted: 0, errors: [] };
    
    try {
      const uploadsDir = path.join(__dirname, '../../uploads');
      
      // This is a simplified version - you'd want to implement proper orphan detection
      // by checking files against database records
      
      console.log(`📁 Orphaned file cleanup not yet fully implemented`);
      
    } catch (error) {
      result.errors.push(`Error cleaning orphaned files: ${error.message}`);
    }

    return result;
  },

  // Log cleanup summary for monitoring
  logCleanupSummary(results) {
    const totalDeleted = Object.values(results).reduce((sum, val) => {
      if (typeof val === 'number') return sum + val;
      return sum;
    }, 0);

    const totalErrors = results.errors.length;

    console.log(`📊 Cleanup Summary:`);
    console.log(`   Total items deleted: ${totalDeleted}`);
    console.log(`   Total errors: ${totalErrors}`);
    
    if (totalErrors > 0) {
      console.log(`   Errors: ${results.errors.join(', ')}`);
    }

    // You could also send this to a monitoring service
    // or write to a log file for audit purposes
  },

  // Get retention periods (for admin display)
  getRetentionPeriods() {
    return RETENTION_PERIODS;
  },

  // Update retention periods (admin function)
  updateRetentionPeriods(newPeriods) {
    Object.assign(RETENTION_PERIODS, newPeriods);
    console.log('📝 Updated retention periods:', RETENTION_PERIODS);
  }
};

module.exports = DataCleanupService;
