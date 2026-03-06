// Create test daily reports for multiple locations on the same date
const { MongoClient } = require('mongodb');
const { MONGODB_URI } = require('./src/config/env');

async function createTestLocationData() {
  try {
    console.log('=== Creating Test Location Data ===\n');
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db();
    
    // Create a second daily report for Location B on the same date
    const locationBReport = {
      projectName: 'sds',
      reportDate: new Date('2026-03-06'),
      location: 'Location B',
      managementTeam: [
        {
          description: 'Construction Manager',
          unit: '',
          prev: 0,
          today: 2,  // Different value from Location A
          accumulated: 2
        },
        {
          description: 'Project Manager',
          unit: '',
          prev: 0,
          today: 1,  // Different value from Location A
          accumulated: 1
        },
        {
          description: 'Site Manager',
          unit: '',
          prev: 0,
          today: 3,
          accumulated: 3
        }
      ],
      workingTeamInterior: [
        {
          description: 'Site Engineer',
          unit: '',
          prev: 0,
          today: 2,
          accumulated: 2
        }
      ],
      workingTeamMEP: [
        {
          description: 'MEP Supervisor',
          unit: '',
          prev: 0,
          today: 1,
          accumulated: 1
        }
      ],
      userId: '698eace46c7b770e92d18c4f',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    console.log('Creating Location B daily report...');
    const result = await db.collection('dailyreports').insertOne(locationBReport);
    console.log(`✅ Created report with ID: ${result.insertedId}`);
    
    // Now test the aggregation
    console.log('\n=== Testing Aggregation with Multiple Locations ===');
    
    const { aggregateManpowerData } = require('./src/utils/manpowerAggregation');
    
    const aggregationResult = await aggregateManpowerData(
      'sds',
      new Date('2026-03-06'),
      new Date('2026-03-12'),
      {
        includePrevWeek: false,
        includeAccumulated: false
      }
    );
    
    if (aggregationResult.success) {
      console.log('✅ Aggregation successful!');
      console.log('\nAggregated results:');
      
      // Show Construction Manager and Project Manager totals
      const mgmtTeam = aggregationResult.data.manPower.managementTeam;
      const constructionManager = mgmtTeam.find(r => r.description === 'Construction Manager');
      const projectManager = mgmtTeam.find(r => r.description === 'Project Manager');
      
      if (constructionManager) {
        console.log(`Construction Manager: ${constructionManager.date.fri} (should be 1+2=3)`);
      }
      if (projectManager) {
        console.log(`Project Manager: ${projectManager.date.fri} (should be 2+1=3)`);
      }
      
      console.log('\nFull management team:');
      mgmtTeam.forEach(person => {
        console.log(`  ${person.description}: Friday=${person.date.fri}, This Week=${person.thisWeek}`);
      });
    }
    
    await client.close();
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

createTestLocationData();
