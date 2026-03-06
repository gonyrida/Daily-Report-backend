// Test to check if there are multiple daily reports for the same date
const { MongoClient } = require('mongodb');
const { MONGODB_URI } = require('./src/config/env');

async function testLocationAggregation() {
  try {
    console.log('=== Testing Location Aggregation ===\n');
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db();
    
    // Find all daily reports for project "sds" on March 6, 2026
    const targetDate = new Date('2026-03-06');
    const nextDay = new Date('2026-03-07');
    
    console.log(`Looking for daily reports for project "sds" on March 6, 2026`);
    
    const reports = await db.collection('dailyreports')
      .find({
        projectName: 'sds',
        reportDate: {
          $gte: targetDate,
          $lt: nextDay
        }
      })
      .toArray();
    
    console.log(`Found ${reports.length} daily reports for March 6, 2026:`);
    
    reports.forEach((report, index) => {
      console.log(`\nReport ${index + 1}:`);
      console.log(`  ID: ${report._id}`);
      console.log(`  Date: ${report.reportDate}`);
      console.log(`  Location: ${report.location || 'No location field'}`);
      console.log(`  Management Team: ${report.managementTeam?.length || 0} items`);
      
      if (report.managementTeam && report.managementTeam.length > 0) {
        console.log(`  Management Team Details:`);
        report.managementTeam.forEach((person, i) => {
          console.log(`    ${i + 1}. ${person.description}: today=${person.today}`);
        });
      }
    });
    
    // Test the aggregation logic manually
    console.log('\n=== Testing Manual Aggregation ===');
    
    let totalConstructionManager = 0;
    let totalProjectManager = 0;
    
    reports.forEach(report => {
      if (report.managementTeam) {
        report.managementTeam.forEach(person => {
          if (person.description === 'Construction Manager') {
            totalConstructionManager += person.today || 0;
          }
          if (person.description === 'Project Manager') {
            totalProjectManager += person.today || 0;
          }
        });
      }
    });
    
    console.log(`Aggregated totals for March 6:`);
    console.log(`  Construction Manager: ${totalConstructionManager}`);
    console.log(`  Project Manager: ${totalProjectManager}`);
    
    await client.close();
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testLocationAggregation();
