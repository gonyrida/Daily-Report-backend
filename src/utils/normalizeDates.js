const mongoose = require('mongoose');
const DailyReport = require('../models/dailyReportModel');
// dotenv.config() is already called in server.js 

async function migrate() {
  try {
    // MongoDB connection is handled by the main app
    // No need to connect here as it's already connected in the main app
    console.log("Connected to MongoDB successfully...");

    const reports = await DailyReport.find({});
    let updateCount = 0;
    
    for (let report of reports) {
      const d = new Date(report.reportDate);
      
      // Force date to Midnight UTC regardless of current time
      const normalized = new Date(Date.UTC(
        d.getUTCFullYear(), 
        d.getUTCMonth(), 
        d.getUTCDate(), 
        0, 0, 0, 0
      ));
      
      if (report.reportDate.toISOString() !== normalized.toISOString()) {
        console.log(`Fixing ${report.projectName}: ${report.reportDate.toISOString()} -> ${normalized.toISOString()}`);
        report.reportDate = normalized;
        await report.save();
        updateCount++;
      }
    }
    
    console.log(`\nMigration Complete! ${updateCount} reports updated.`);
    process.exit(0);
  } catch (err) {
    console.error("Migration Error:", err);
    process.exit(1);
  }
}

migrate();