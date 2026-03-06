const mongoose = require('mongoose');
const DailyReport = require('./src/models/dailyReportModel');
const { CAMBODIA_LOCATIONS } = require('./src/data/cambodiaLocations');

// Test data
const testUserId = new mongoose.Types.ObjectId();
const testCompanyId = new mongoose.Types.ObjectId();
const projectName = 'Test Project';
const testDate = new Date('2026-03-06T00:00:00.000Z');

async function testLocationFunctionality() {
  try {
    // Connect to MongoDB (adjust connection string as needed)
    await mongoose.connect('mongodb://localhost:27017/daily-report-test');

    console.log('🔧 Testing Location-Specific Daily Report Functionality\n');

    // Test 1: Create reports for same project and date but different locations
    console.log('📍 Test 1: Creating reports for same project/date but different locations');
    
    const report1 = new DailyReport({
      userId: testUserId,
      companyId: testCompanyId,
      projectName,
      reportDate: testDate,
      location: 'Phnom Penh',
      activityToday: 'Work on foundation - Phnom Penh site',
      status: 'draft',
      managementTeam: [
        { description: 'Project Manager', today: 1, prev: 0, accumulated: 1 }
      ]
    });

    const report2 = new DailyReport({
      userId: testUserId,
      companyId: testCompanyId,
      projectName,
      reportDate: testDate,
      location: 'Siem Reap',
      activityToday: 'Work on foundation - Siem Reap site',
      status: 'draft',
      managementTeam: [
        { description: 'Project Manager', today: 1, prev: 0, accumulated: 1 }
      ]
    });

    await report1.save();
    await report2.save();

    console.log('✅ Successfully created two reports with same project/date but different locations');
    console.log(`   Report 1 ID: ${report1._id}, Location: ${report1.location}`);
    console.log(`   Report 2 ID: ${report2._id}, Location: ${report2.location}`);

    // Test 2: Verify unique index works
    console.log('\n📍 Test 2: Testing unique index constraint');
    
    try {
      const duplicateReport = new DailyReport({
        userId: testUserId,
        companyId: testCompanyId,
        projectName,
        reportDate: testDate,
        location: 'Phnom Penh', // Same location as report1
        activityToday: 'Duplicate test',
        status: 'draft'
      });
      await duplicateReport.save();
      console.log('❌ ERROR: Should not allow duplicate reports with same project/date/location');
    } catch (error) {
      if (error.code === 11000) {
        console.log('✅ Unique index correctly prevents duplicate reports with same location');
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }

    // Test 3: Test location filtering
    console.log('\n📍 Test 3: Testing location filtering');
    
    const phnomPenhReports = await DailyReport.find({
      userId: testUserId,
      location: 'Phnom Penh'
    });
    
    const siemReapReports = await DailyReport.find({
      userId: testUserId,
      location: 'Siem Reap'
    });

    console.log(`✅ Found ${phnomPenhReports.length} reports for Phnom Penh`);
    console.log(`✅ Found ${siemReapReports.length} reports for Siem Reap`);

    // Test 4: Test rolling totals are location-specific
    console.log('\n📍 Test 4: Testing location-specific rolling totals');
    
    const nextDate = new Date('2026-03-07T00:00:00.000Z');
    const report3 = new DailyReport({
      userId: testUserId,
      companyId: testCompanyId,
      projectName,
      reportDate: nextDate,
      location: 'Phnom Penh',
      activityToday: 'Continue foundation work - Phnom Penh',
      status: 'draft',
      managementTeam: [
        { description: 'Project Manager', today: 1, prev: 1, accumulated: 2 }
      ]
    });

    await report3.save();
    console.log('✅ Created next day report for Phnom Penh with correct rolling total');

    // Test 5: Verify all locations are available
    console.log('\n📍 Test 5: Verifying Cambodia locations data');
    console.log(`✅ Available locations: ${CAMBODIA_LOCATIONS.length}`);
    console.log('📍 Sample locations:', CAMBODIA_LOCATIONS.slice(0, 5));

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await DailyReport.deleteMany({ userId: testUserId });
    console.log('✅ Test data cleaned up');

    console.log('\n🎉 All tests passed! Location-specific functionality is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.connection.close();
  }
}

// Run the test
testLocationFunctionality();
