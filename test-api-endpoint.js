// Test the API endpoint directly
const express = require('express');
const { aggregateManpowerData } = require('./src/utils/manpowerAggregation');

const app = express();
app.use(express.json());

// Copy the controller logic for testing
const aggregateManpower = async (req, res) => {
  try {
    const { projectName, startDate, endDate } = req.query;
    const { includePrevWeek = false, includeAccumulated = false } = req.body;

    console.log('API Call received:');
    console.log('  projectName:', projectName);
    console.log('  startDate:', startDate);
    console.log('  endDate:', endDate);
    console.log('  includePrevWeek:', includePrevWeek);
    console.log('  includeAccumulated:', includeAccumulated);

    if (!projectName || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: projectName, startDate, endDate'
      });
    }

    const options = { includePrevWeek, includeAccumulated };
    const result = await aggregateManpowerData(
      projectName,
      new Date(startDate),
      new Date(endDate),
      options
    );

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        details: result.details
      });
    }
  } catch (error) {
    console.error('Controller error in aggregateManpower:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Add the route
app.post('/aggregate-manpower', aggregateManpower);

// Test the endpoint
app.listen(3001, () => {
  console.log('Test server running on port 3001');
  
  // Test the endpoint
  const testRequest = {
    projectName: 'sds',
    startDate: '2026-03-06',
    endDate: '2026-03-12'
  };
  
  const testBody = {
    includePrevWeek: false,
    includeAccumulated: false
  };
  
  const queryString = new URLSearchParams(testRequest).toString();
  
  fetch(`http://localhost:3001/aggregate-manpower?${queryString}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(testBody)
  })
  .then(res => res.json())
  .then(data => {
    console.log('API Response:', JSON.stringify(data, null, 2));
    process.exit(0);
  })
  .catch(error => {
    console.error('API Error:', error);
    process.exit(1);
  });
});
