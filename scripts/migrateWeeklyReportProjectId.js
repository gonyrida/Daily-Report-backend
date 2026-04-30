/**
 * Migration script to fix weekly reports missing projectId
 * Run this script to update all weekly reports that have null or missing projectId
 * 
 * Usage: node scripts/migrateWeeklyReportProjectId.js
 */

const mongoose = require('mongoose');
const WeeklyReport = require('../src/models/WeeklyReport');
const Project = require('../src/models/projectModel');
require('dotenv').config();

async function migrateWeeklyReportProjectIds() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/daily-report';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB:', mongoUri);

    // Find all weekly reports with null or missing projectId
    const reportsWithoutProjectId = await WeeklyReport.find({
      $or: [
        { projectId: { $exists: false } },
        { projectId: null }
      ]
    });

    console.log(`Found ${reportsWithoutProjectId.length} weekly reports without projectId`);

    if (reportsWithoutProjectId.length === 0) {
      console.log('No reports need migration. Exiting...');
      process.exit(0);
    }
    
    // Debug: Show available projects
    console.log('\n--- Available Projects ---');
    const allProjects = await Project.find({ isActive: true }).select('name _id');
    allProjects.forEach(p => console.log(`  - ${p.name} (${p._id})`));
    console.log('---');
    console.log(`Total projects: ${allProjects.length}\n`);

    let successCount = 0;
    let failCount = 0;
    let failedReports = [];

    for (const report of reportsWithoutProjectId) {
      try {
        console.log(`\nProcessing report: ${report._id} (projectName: ${report.projectName})`);

        // Skip if no projectName
        if (!report.projectName) {
          console.warn(`  ⚠️ Report ${report._id} has no projectName, cannot resolve projectId`);
          failCount++;
          failedReports.push({ id: report._id, reason: 'No projectName' });
          continue;
        }

        // Look up project by name (trim whitespace and use partial matching)
        const trimmedProjectName = report.projectName.trim();
        
        // Try exact match first
        let project = await Project.findOne({
          name: { $regex: new RegExp(`^${trimmedProjectName}$`, 'i') },
          isActive: true
        });
        
        // If not found, try partial match
        if (!project) {
          // Escape special regex characters for partial match
          const escapedName = trimmedProjectName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          project = await Project.findOne({
            name: { $regex: escapedName, $options: 'i' },
            isActive: true
          });
        }
        
        // If still not found, try without "The Project for Building Capacity" part
        if (!project && trimmedProjectName.includes('Building Capacity')) {
          const shortName = trimmedProjectName.replace(/The Project for Building Capacity and Establishing Enabling Environment in ICT Majors of TVET in Cambodia/gi, '').trim();
          project = await Project.findOne({
            name: { $regex: shortName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
            isActive: true
          });
        }
        
        // If still not found, try extracting key parts (e.g., "ICT-NIB" from "ICT-NIB Renovation Works...")
        if (!project) {
          const keyMatch = trimmedProjectName.match(/^(ICT-[A-Z]+)/i);
          if (keyMatch) {
            const keyPart = keyMatch[1];
            console.log(`    Trying key part match: "${keyPart}"`);
            project = await Project.findOne({
              name: { $regex: keyPart, $options: 'i' },
              isActive: true
            });
          }
        }

        if (!project) {
          console.warn(`  ⚠️ No project found with name: ${report.projectName}`);
          failCount++;
          failedReports.push({ id: report._id, reason: `Project not found: ${report.projectName}` });
          continue;
        }

        // Update the report with the resolved projectId
        report.projectId = project._id;
        await report.save();

        console.log(`  ✅ Updated report ${report._id} with projectId: ${project._id}`);
        successCount++;

      } catch (error) {
        console.error(`  ❌ Error updating report ${report._id}:`, error.message);
        failCount++;
        failedReports.push({ id: report._id, reason: error.message });
      }
    }

    console.log('\n========================================');
    console.log('Migration Summary:');
    console.log(`  Total reports processed: ${reportsWithoutProjectId.length}`);
    console.log(`  Successfully updated: ${successCount}`);
    console.log(`  Failed: ${failCount}`);
    
    if (failedReports.length > 0) {
      console.log('\nFailed reports:');
      failedReports.forEach(f => console.log(`  - ${f.id}: ${f.reason}`));
    }
    console.log('========================================');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the migration
migrateWeeklyReportProjectIds();
