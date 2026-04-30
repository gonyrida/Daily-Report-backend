/**
 * Script to check daily report HSE section titles
 */

const mongoose = require('mongoose');
const DailyReport = require('../src/models/dailyReportModel');
require('dotenv').config();

async function checkSections() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/daily-report';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB\n');

    // Check reports from the week that was aggregated (Apr 17-23, 2026)
    const startDate = new Date('2026-04-16');
    const endDate = new Date('2026-04-23');
    
    // For ICT-NPIT project (69b7a66bf483fae700ae6fdc)
    const projectId = '69b7a66bf483fae700ae6fdc';
    
    const reports = await DailyReport.find({
      projectId: new mongoose.Types.ObjectId(projectId),
      reportDate: { $gte: startDate, $lte: endDate }
    }).select('reportDate hse referenceSections projectName').lean();

    console.log(`Found ${reports.length} daily reports for project ICT-NPIT\n`);
    console.log('========================================');

    for (const report of reports) {
      console.log(`\nDate: ${report.reportDate.toDateString()}`);
      console.log(`Project: ${report.projectName}`);
      
      console.log('\nHSE Sections:');
      const hseSections = report.hse || [];
      if (hseSections.length === 0) {
        console.log('  (none)');
      } else {
        hseSections.forEach((section, i) => {
          const imageCount = section.images?.length || 0;
          console.log(`  ${i+1}. "${section.section_title}" - ${imageCount} images`);
        });
      }
      
      console.log('\nReference Sections:');
      const refSections = report.referenceSections || [];
      if (refSections.length === 0) {
        console.log('  (none)');
      } else {
        refSections.forEach((section, i) => {
          const entryCount = section.entries?.length || 0;
          console.log(`  ${i+1}. "${section.title}" - ${entryCount} entries`);
        });
      }
      
      console.log('----------------------------------------');
    }

    // Summary of all unique section titles
    console.log('\n\n========== UNIQUE SECTION TITLES ==========');
    const allTitles = new Set();
    reports.forEach(r => {
      (r.hse || []).forEach(s => allTitles.add(s.section_title));
      (r.referenceSections || []).forEach(s => allTitles.add(s.title));
    });
    
    console.log('All unique section titles found:');
    allTitles.forEach(title => {
      const isToolbox = title?.toLowerCase().includes('toolbox') || title?.toLowerCase().includes('meeting');
      const isActivity = title?.toLowerCase().includes('activity') || !isToolbox;
      console.log(`  - "${title}"`);
      console.log(`    -> Would be classified as: ${isToolbox ? 'TOOLBOX' : (isActivity ? 'ACTIVITY' : 'UNKNOWN')}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

checkSections();
