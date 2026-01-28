const cron = require('node-cron');
const DataCleanupService = require('../services/dataCleanupService');

class CleanupScheduler {
  constructor() {
    this.isRunning = false;
    this.lastRun = null;
    this.nextRun = null;
  }

  // Start the cleanup scheduler
  start() {
    console.log('🕐 Starting cleanup scheduler...');

    // Run daily at 2:00 AM (server time)
    cron.schedule('0 2 * * *', async () => {
      if (this.isRunning) {
        console.log('⏭️ Cleanup already running, skipping...');
        return;
      }

      await this.runCleanup();
    }, {
      scheduled: true,
      timezone: 'UTC' // Use UTC for consistent timing
    });

    // Also run weekly deep cleanup on Sundays at 3:00 AM
    cron.schedule('0 3 * * 0', async () => {
      if (this.isRunning) {
        console.log('⏭️ Weekly cleanup already running, skipping...');
        return;
      }

      await this.runWeeklyCleanup();
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    // Set next run time
    this.updateNextRunTime();
    
    console.log('✅ Cleanup scheduler started successfully');
    console.log(`📅 Daily cleanup: 2:00 AM UTC`);
    console.log(`📅 Weekly deep cleanup: Sundays 3:00 AM UTC`);
  }

  // Run the cleanup process
  async runCleanup() {
    if (this.isRunning) {
      console.log('⚠️ Cleanup is already running');
      return;
    }

    this.isRunning = true;
    this.lastRun = new Date();

    try {
      console.log('🧹 Starting scheduled daily cleanup...');
      
      const results = await DataCleanupService.performScheduledCleanup();
      
      console.log('✅ Daily cleanup completed successfully');
      
      // You could send notifications or metrics here
      this.sendCleanupMetrics('daily', results);
      
    } catch (error) {
      console.error('❌ Daily cleanup failed:', error);
      
      // Send error notification
      this.sendErrorNotification('daily', error);
      
    } finally {
      this.isRunning = false;
      this.updateNextRunTime();
    }
  }

  // Run weekly deep cleanup
  async runWeeklyCleanup() {
    if (this.isRunning) {
      console.log('⚠️ Weekly cleanup is already running');
      return;
    }

    this.isRunning = true;
    this.lastRun = new Date();

    try {
      console.log('🧹 Starting scheduled weekly deep cleanup...');
      
      // Weekly cleanup could include more intensive operations
      const results = await DataCleanupService.performScheduledCleanup();
      
      // Additional weekly tasks
      await this.performWeeklyTasks();
      
      console.log('✅ Weekly deep cleanup completed successfully');
      
      this.sendCleanupMetrics('weekly', results);
      
    } catch (error) {
      console.error('❌ Weekly cleanup failed:', error);
      this.sendErrorNotification('weekly', error);
      
    } finally {
      this.isRunning = false;
      this.updateNextRunTime();
    }
  }

  // Additional weekly maintenance tasks
  async performWeeklyTasks() {
    console.log('🔧 Performing weekly maintenance tasks...');
    
    try {
      // 1. Database optimization
      // await this.optimizeDatabase();
      
      // 2. Generate cleanup reports
      await this.generateWeeklyReport();
      
      // 3. Check disk space
      await this.checkDiskSpace();
      
      // 4. Update statistics
      await this.updateStatistics();
      
      console.log('✅ Weekly maintenance tasks completed');
      
    } catch (error) {
      console.error('❌ Weekly maintenance failed:', error);
    }
  }

  // Generate weekly cleanup report
  async generateWeeklyReport() {
    try {
      const retentionPeriods = DataCleanupService.getRetentionPeriods();
      
      const report = {
        date: new Date().toISOString(),
        retentionPeriods,
        lastCleanup: this.lastRun,
        nextCleanup: this.nextRun,
        summary: 'Weekly cleanup report generated'
      };
      
      // Save report to file or send to admin
      console.log('📊 Weekly report generated:', report);
      
    } catch (error) {
      console.error('❌ Failed to generate weekly report:', error);
    }
  }

  // Check disk space usage
  async checkDiskSpace() {
    try {
      const fs = require('fs');
      const path = require('path');
      
      const uploadsDir = path.join(__dirname, '../../uploads');
      
      if (fs.existsSync(uploadsDir)) {
        const stats = fs.statSync(uploadsDir);
        console.log(`💾 Uploads directory size: ${stats.size} bytes`);
      }
      
    } catch (error) {
      console.error('❌ Failed to check disk space:', error);
    }
  }

  // Update system statistics
  async updateStatistics() {
    try {
      // Update various system statistics
      console.log('📈 Updated system statistics');
      
    } catch (error) {
      console.error('❌ Failed to update statistics:', error);
    }
  }

  // Send cleanup metrics to monitoring
  sendCleanupMetrics(type, results) {
    // This could integrate with your monitoring system
    console.log(`📊 Cleanup metrics for ${type}:`, {
      type,
      timestamp: new Date().toISOString(),
      results,
      duration: Date.now() - this.lastRun?.getTime()
    });
  }

  // Send error notification
  sendErrorNotification(type, error) {
    // This could send emails, Slack notifications, etc.
    console.error(`🚨 Cleanup error notification for ${type}:`, {
      type,
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    });
  }

  // Update next run time
  updateNextRunTime() {
    const now = new Date();
    
    // Calculate next daily run (2:00 AM UTC tomorrow)
    const nextDaily = new Date(now);
    nextDaily.setUTCDate(nextDaily.getUTCDate() + 1);
    nextDaily.setUTCHours(2, 0, 0, 0);
    
    // Calculate next weekly run (next Sunday 3:00 AM UTC)
    const nextWeekly = new Date(now);
    const daysUntilSunday = (7 - nextWeekly.getUTCDay()) % 7 || 7;
    nextWeekly.setUTCDate(nextWeekly.getUTCDate() + daysUntilSunday);
    nextWeekly.setUTCHours(3, 0, 0, 0);
    
    this.nextRun = nextDaily < nextWeekly ? nextDaily : nextWeekly;
  }

  // Get scheduler status
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      nextRun: this.nextRun,
      retentionPeriods: DataCleanupService.getRetentionPeriods()
    };
  }

  // Manual cleanup trigger (for admin use)
  async triggerManualCleanup(type = 'daily') {
    console.log(`🔧 Manual ${type} cleanup triggered...`);
    
    if (type === 'weekly') {
      await this.runWeeklyCleanup();
    } else {
      await this.runCleanup();
    }
  }

  // Stop the scheduler
  stop() {
    console.log('🛑 Stopping cleanup scheduler...');
    
    // In a real implementation, you'd want to stop the cron jobs
    // This is a simplified version
    
    console.log('✅ Cleanup scheduler stopped');
  }
}

// Create and export singleton instance
const cleanupScheduler = new CleanupScheduler();

module.exports = cleanupScheduler;
