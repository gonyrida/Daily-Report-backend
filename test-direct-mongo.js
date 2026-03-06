// Test MongoDB connection directly
const { MongoClient } = require('mongodb');
const { MONGODB_URI } = require('./src/config/env');

async function testDirectMongo() {
  try {
    console.log('=== Testing Direct MongoDB Connection ===\n');
    
    // Connect directly with MongoDB driver
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('✅ Connected to MongoDB directly');
    
    const db = client.db(); // Use default database from URI
    
    // Test simple query
    console.log('Testing simple count query...');
    const count = await db.collection('dailyreports').countDocuments({
      projectName: 'sds',
      reportDate: {
        $gte: new Date('2026-03-06'),
        $lte: new Date('2026-03-12')
      }
    });
    console.log(`Found ${count} documents`);
    
    // Test find query with projection
    console.log('Testing find query with projection...');
    const docs = await db.collection('dailyreports')
      .find({
        projectName: 'sds',
        reportDate: {
          $gte: new Date('2026-03-06'),
          $lte: new Date('2026-03-12')
        }
      })
      .project({
        reportDate: 1,
        managementTeam: 1,
        workingTeamInterior: 1,
        workingTeamMEP: 1,
        _id: 0
      })
      .limit(5)
      .toArray();
    
    console.log(`Found ${docs.length} documents:`);
    docs.forEach((doc, i) => {
      console.log(`Doc ${i + 1}:`, {
        reportDate: doc.reportDate,
        managementTeamCount: doc.managementTeam?.length || 0,
        interiorTeamCount: doc.workingTeamInterior?.length || 0,
        mepTeamCount: doc.workingTeamMEP?.length || 0
      });
    });
    
    await client.close();
    console.log('✅ Direct MongoDB test successful');
    
  } catch (error) {
    console.error('❌ Direct MongoDB test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testDirectMongo();
