// Test script to verify frontend manpower aggregation API calls
const { aggregateManpower, updateReportManpower } = require('./src/services/weeklyReportService');

async function testFrontendAggregation() {
  console.log('=== Testing Frontend Manpower Aggregation ===\n');
  
  try {
    // Test 1: Aggregate manpower data
    console.log('1. Testing aggregateManpower...');
    const aggregateResult = await aggregateManpower(
      'sds', // Project name from debug
      '2026-03-06',
      '2026-03-12',
      {
        includePrevWeek: true,
        includeAccumulated: true
      }
    );
    
    console.log('Aggregate result:', JSON.stringify(aggregateResult, null, 2));
    
    if (aggregateResult.success) {
      console.log('✅ Aggregation successful');
      
      // Test 2: Update report with manpower (if we have a report ID)
      const testReportId = '69a940e624cb8380000411ad'; // From debug output
      
      console.log('\n2. Testing updateReportManpower...');
      const updateResult = await updateReportManpower(testReportId, {
        includePrevWeek: true,
        includeAccumulated: true
      });
      
      console.log('Update result:', JSON.stringify(updateResult, null, 2));
      
      if (updateResult.success) {
        console.log('✅ Update successful');
      } else {
        console.log('❌ Update failed:', updateResult.error);
      }
    } else {
      console.log('❌ Aggregation failed:', aggregateResult.error);
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

testFrontendAggregation();
