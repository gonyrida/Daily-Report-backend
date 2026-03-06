// Simple test to check aggregation without frontend
const { aggregateManpowerData } = require('./src/utils/manpowerAggregation');
const { MONGODB_URI } = require('./src/config/env');
const mongoose = require('mongoose');

async function testAggregationDirectly() {
  try {
    console.log('=== Testing Aggregation Directly ===\n');
    
    // Connect to database
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Test aggregation with the exact same parameters
    console.log('Testing aggregation for project: sds');
    console.log('Date range: 2026-03-06 to 2026-03-12');
    
    const result = await aggregateManpowerData(
      'sds',
      new Date('2026-03-06'),
      new Date('2026-03-12'),
      {
        includePrevWeek: false,
        includeAccumulated: false
      }
    );
    
    console.log('\nResult:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('✅ Direct aggregation successful');
      
      // Check if data has content
      const mgmtTeam = result.data.manPower.managementTeam;
      const interiorTeam = result.data.manPower.workingTeamInterior;
      const mepTeam = result.data.manPower.workingTeamMEP;
      
      console.log('\nData Summary:');
      console.log(`Management Team: ${mgmtTeam.length} items`);
      console.log(`Interior Team: ${interiorTeam.length} items`);
      console.log(`MEP Team: ${mepTeam.length} items`);
      
      if (mgmtTeam.length > 0) {
        console.log('\nFirst Management Team item:', JSON.stringify(mgmtTeam[0], null, 2));
      }
    } else {
      console.log('❌ Direct aggregation failed:', result.error);
      console.log('Details:', result.details);
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.disconnect();
  }
}

testAggregationDirectly();
