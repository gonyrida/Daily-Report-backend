const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/daily-report')
  .then(async () => {
    console.log('Connected to MongoDB');
    
    // Find reports with actual non-empty material data
    const reportsWithMaterials = await mongoose.connection.collection('weeklyreports').find({
      'sections.resources.material': { $exists: true, $not: { $size: 0 } }
    }).limit(3).toArray();
    
    console.log('Reports with non-empty materials:', reportsWithMaterials.length);
    
    // Find reports with actual non-empty machinery data
    const reportsWithMachinery = await mongoose.connection.collection('weeklyreports').find({
      'sections.resources.machinery': { $exists: true, $not: { $size: 0 } }
    }).limit(3).toArray();
    
    console.log('Reports with non-empty machinery:', reportsWithMachinery.length);
    
    // Check sample data if any found
    if (reportsWithMaterials.length > 0) {
      console.log('Sample material data:');
      console.log(JSON.stringify(reportsWithMaterials[0].sections.resources.material[0], null, 2));
    }
    
    if (reportsWithMachinery.length > 0) {
      console.log('Sample machinery data:');
      console.log(JSON.stringify(reportsWithMachinery[0].sections.resources.machinery[0], null, 2));
    }
    
    // Total reports count for context
    const totalReports = await mongoose.connection.collection('weeklyreports').countDocuments();
    console.log('Total reports in database:', totalReports);
    
    await mongoose.disconnect();
  })
  .catch(err => {
    console.error('Database connection error:', err);
    process.exit(1);
  });
