const mongoose = require('mongoose');
require('dotenv').config();

// Import your models
const DailyReport = require('./src/models/dailyReportModel');
const WeeklyReport = require('./src/models/WeeklyReport');
const Project = require('./src/models/projectModel');

const migrate = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // ─── Daily Reports ───────────────────────────────────────────
  const dailyReports = await DailyReport.find({ 
    projectId: { $exists: false } 
  });
  
  console.log(`Found ${dailyReports.length} daily reports missing projectId`);

  let dailyFixed = 0;
  let dailySkipped = 0;

  for (const report of dailyReports) {
    if (!report.projectName) {
      console.log(`⚠️  Skipping daily report ${report._id} - no projectName`);
      dailySkipped++;
      continue;
    }

    // Find project by name (case-insensitive)
    const project = await Project.findOne({ 
      name: { $regex: new RegExp(`^${report.projectName}$`, 'i') },
      companyId: report.companyId
    });

    if (project) {
      await DailyReport.updateOne(
        { _id: report._id },
        { $set: { projectId: project._id } }
      );
      console.log(`✅ Daily report ${report._id} → projectId: ${project._id} (${project.name})`);
      dailyFixed++;
    } else {
      console.log(`❌ No project found for daily report ${report._id} with name: "${report.projectName}"`);
      dailySkipped++;
    }
  }

  // ─── Weekly Reports ──────────────────────────────────────────
  const weeklyReports = await WeeklyReport.find({ 
    projectId: { $exists: false } 
  });

  console.log(`\nFound ${weeklyReports.length} weekly reports missing projectId`);

  let weeklyFixed = 0;
  let weeklySkipped = 0;

  for (const report of weeklyReports) {
    if (!report.projectName) {
      console.log(`⚠️  Skipping weekly report ${report._id} - no projectName`);
      weeklySkipped++;
      continue;
    }

    // Try exact match first
    let project = await Project.findOne({ 
      name: { $regex: new RegExp(`^${report.projectName}$`, 'i') },
      companyId: report.companyId
    });

    // If no exact match, try partial match (contains)
    if (!project) {
      project = await Project.findOne({ 
        name: { $regex: new RegExp(report.projectName, 'i') },
        companyId: report.companyId
      });
    }

    // If still no match, try matching first few words
    if (!project && report.projectName.length > 10) {
      const firstWords = report.projectName.split(' ').slice(0, 3).join(' ');
      project = await Project.findOne({ 
        name: { $regex: new RegExp(firstWords, 'i') },
        companyId: report.companyId
      });
    }

    // If still no match, try to find any project that contains key words
    if (!project) {
      const keyWords = report.projectName.split(' ').filter(word => word.length > 3);
      for (const word of keyWords) {
        project = await Project.findOne({ 
          name: { $regex: new RegExp(word, 'i') },
          companyId: report.companyId
        });
        if (project) break;
      }
    }

    // Final fallback: try to match any project in the company (for test data)
    if (!project) {
      console.log(`🔍 Final fallback: trying any project for company ${report.companyId}`);
      project = await Project.findOne({ companyId: report.companyId });
    }

    if (project) {
      await WeeklyReport.updateOne(
        { _id: report._id },
        { $set: { projectId: project._id } }
      );
      console.log(`✅ Weekly report ${report._id} → projectId: ${project._id} (${project.name})`);
      weeklyFixed++;
    } else {
      console.log(`❌ No project found for weekly report ${report._id} with name: "${report.projectName}"`);
      weeklySkipped++;
    }
  }

  // ─── Summary ─────────────────────────────────────────────────
  console.log('\n========== MIGRATION COMPLETE ==========');
  console.log(`Daily Reports:  ${dailyFixed} fixed, ${dailySkipped} skipped`);
  console.log(`Weekly Reports: ${weeklyFixed} fixed, ${weeklySkipped} skipped`);
  console.log('========================================');

  await mongoose.disconnect();
};

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
