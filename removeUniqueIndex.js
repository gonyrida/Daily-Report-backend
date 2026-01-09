const mongoose = require('mongoose');
const DailyReport = require('./src/models/dailyReportModel');

// MongoDB connection string - update this to match your configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';

async function removeUniqueIndex() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get the collection
    const db = mongoose.connection.db;
    const collection = db.collection('dailyreports');

    // List all indexes
    const indexes = await collection.indexes();
    console.log('Current indexes:', indexes);

    // Find and drop the unique index on projectName and reportDate
    const uniqueIndex = indexes.find(index => 
      index.projectName === 1 && index.reportDate === 1 && index.unique === true
    );

    if (uniqueIndex) {
      console.log('Found unique index:', uniqueIndex.name);
      
      // Drop the unique index
      await collection.dropIndex(uniqueIndex.name);
      console.log('✅ Unique index dropped successfully');
    } else {
      console.log('❌ No unique index found on projectName and reportDate');
    }

    // Verify the indexes after dropping
    const updatedIndexes = await collection.indexes();
    console.log('Updated indexes:', updatedIndexes);

  } catch (error) {
    console.error('Error removing unique index:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
removeUniqueIndex();
