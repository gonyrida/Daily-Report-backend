const DailyReport = require('./src/models/dailyReportModel');
const WeeklyReport = require('./src/models/WeeklyReport');
const { MONGODB_URI } = require('./src/config/env');
const mongoose = require('mongoose');

async function debugManpower() {
  try {
    // Use the same connection as your app
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB with URI:', MONGODB_URI);
    
    // 1. Check daily reports for the date range
    console.log('\n=== CHECKING DAILY REPORTS ===');
    const dailyReports = await DailyReport.find({
      reportDate: {
        $gte: new Date('2026-03-06'),
        $lte: new Date('2026-03-12')
      }
    }).select('projectName reportDate managementTeam workingTeamInterior workingTeamMEP');
    
    console.log(`Found ${dailyReports.length} daily reports for March 6-12, 2026`);
    
    dailyReports.forEach((report, index) => {
      console.log(`\nReport ${index + 1}:`);
      console.log(`  Project: ${report.projectName}`);
      console.log(`  Date: ${report.reportDate}`);
      console.log(`  Management Team: ${report.managementTeam?.length || 0} items`);
      console.log(`  Interior Team: ${report.workingTeamInterior?.length || 0} items`);
      console.log(`  MEP Team: ${report.workingTeamMEP?.length || 0} items`);
      
      // Show first few items if they exist
      if (report.managementTeam && report.managementTeam.length > 0) {
        console.log(`  First management item: ${JSON.stringify(report.managementTeam[0])}`);
      }
    });
    
    // 2. Check all projects in daily reports
    console.log('\n=== ALL PROJECTS IN DAILY REPORTS ===');
    const projects = await DailyReport.distinct('projectName');
    console.log('Available projects:', projects);
    
    // 3. Check weekly reports
    console.log('\n=== CHECKING WEEKLY REPORTS ===');
    const weeklyReports = await WeeklyReport.find().select('projectName startDate endDate _id').limit(5);
    console.log(`Found ${weeklyReports.length} weekly reports:`);
    
    weeklyReports.forEach((report, index) => {
      console.log(`  ${index + 1}. ID: ${report._id}, Project: ${report.projectName}, Start: ${report.startDate}, End: ${report.endDate}`);
    });
    
    // 4. Test aggregation with actual project name
    if (dailyReports.length > 0) {
      console.log('\n=== TESTING AGGREGATION ===');
      const { aggregateManpowerData } = require('./src/utils/manpowerAggregation');
      
      const testProject = dailyReports[0].projectName;
      console.log(`Testing aggregation for project: ${testProject}`);
      
      const result = await aggregateManpowerData(
        testProject,
        new Date('2026-03-06'),
        new Date('2026-03-12'),
        { includePrevWeek: false, includeAccumulated: false }
      );
      
      console.log('Aggregation result:', JSON.stringify(result, null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

debugManpower();
