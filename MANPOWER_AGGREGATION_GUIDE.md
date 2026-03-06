# Manpower Aggregation Guide

This guide explains how to use the new manpower aggregation feature that automatically aggregates daily report manpower data into weekly reports.

## Overview

The manpower aggregation system:
1. Fetches daily reports within a weekly date range (Friday to Thursday)
2. Groups manpower by description for each team type
3. Sums the `today` values and maps them to weekday fields
4. Calculates weekly totals and optional previous week/accumulated data
5. Updates the weekly report with the aggregated data

## API Endpoints

### 1. Create Weekly Report with Manpower Aggregation

```http
POST /api/weekly-reports
Content-Type: application/json

{
  "projectName": "Sample Project",
  "weekNumber": 25,
  "startDate": "2024-06-21T00:00:00.000Z",
  "endDate": "2024-06-27T23:59:59.999Z",
  "aggregateManpower": true,
  "aggregationOptions": {
    "includePrevWeek": true,
    "includeAccumulated": true
  },
  "sections": {
    "cover": { ... },
    "letter": { ... },
    // ... other sections
  }
}
```

### 2. Aggregate Manpower Data (Standalone)

```http
POST /api/weekly-reports/aggregate-manpower?projectName=Sample Project&startDate=2024-06-21&endDate=2024-06-27
Content-Type: application/json

{
  "includePrevWeek": true,
  "includeAccumulated": true
}
```

### 3. Update Existing Weekly Report with Manpower

```http
POST /api/weekly-reports/:id/update-manpower
Content-Type: application/json

{
  "includePrevWeek": true,
  "includeAccumulated": true
}
```

## Response Format

### Successful Response

```json
{
  "success": true,
  "data": {
    "manPower": {
      "managementTeam": [
        {
          "description": "Project Manager",
          "date": {
            "fri": 1,
            "sat": 1,
            "sun": 0,
            "mon": 1,
            "tue": 1,
            "wed": 1,
            "thu": 1
          },
          "prevWeek": 6,
          "thisWeek": 6,
          "accumulated": 156
        }
      ],
      "workingTeamInterior": [
        {
          "description": "Carpenters",
          "date": {
            "fri": 8,
            "sat": 8,
            "sun": 0,
            "mon": 8,
            "tue": 8,
            "wed": 8,
            "thu": 8
          },
          "prevWeek": 48,
          "thisWeek": 48,
          "accumulated": 1248
        }
      ],
      "workingTeamMEP": [
        {
          "description": "Electricians",
          "date": {
            "fri": 4,
            "sat": 4,
            "sun": 0,
            "mon": 4,
            "tue": 4,
            "wed": 4,
            "thu": 4
          },
          "prevWeek": 24,
          "thisWeek": 24,
          "accumulated": 624
        }
      ]
    }
  },
  "message": "Manpower data aggregated successfully"
}
```

## Aggregation Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `includePrevWeek` | boolean | false | Include previous week's data for comparison |
| `includeAccumulated` | boolean | false | Include accumulated totals from project start |

## Week Structure

The system follows a Friday-Thursday week structure:

```
Friday    -> date.fri
Saturday  -> date.sat
Sunday    -> date.sun
Monday    -> date.mon
Tuesday   -> date.tue
Wednesday -> date.wed
Thursday  -> date.thu
```

## Important Notes

### Data Source
- Only uses the `today` field from daily reports
- Ignores `prev` and `accumulated` fields from daily reports
- Groups by exact description string matching

### Missing Data
- If no daily report exists for a day, the value is 0
- If no manpower entries exist for a team, the array is empty
- Previous week and accumulated data are optional

### Performance
- Uses MongoDB indexes for efficient querying
- Processes all team types in parallel where possible
- Optimized for weekly date ranges

## Code Examples

### Using the Utility Functions Directly

```javascript
const { aggregateManpowerData } = require('./utils/manpowerAggregation');

// Aggregate manpower for a specific week
const result = await aggregateManpowerData(
  'Sample Project',
  new Date('2024-06-21'), // Friday
  new Date('2024-06-27'), // Thursday
  {
    includePrevWeek: true,
    includeAccumulated: true
  }
);

if (result.success) {
  console.log('Aggregated data:', result.data);
} else {
  console.error('Aggregation failed:', result.error);
}
```

### Updating an Existing Report

```javascript
const { updateWeeklyReportManpower } = require('./utils/manpowerAggregation');

const result = await updateWeeklyReportManpower(
  '60f1b2c3d4e5f6789012345', // Weekly report ID
  {
    includePrevWeek: false,
    includeAccumulated: true
  }
);
```

## Error Handling

### Common Errors

1. **Invalid Date Range**
   ```json
   {
     "success": false,
     "error": "Start date must be before end date"
   }
   ```

2. **Missing Parameters**
   ```json
   {
     "success": false,
     "error": "Missing required parameters: projectName, startDate, endDate"
   }
   ```

3. **Report Not Found**
   ```json
   {
     "success": false,
     "error": "Weekly report not found"
   }
   ```

## Database Schema Impact

### Daily Report (Source)
```javascript
{
  managementTeam: [{
    description: String,
    unit: String,
    prev: Number,        // Ignored in aggregation
    today: Number,       // Used for aggregation
    accumulated: Number   // Ignored in aggregation
  }],
  workingTeamInterior: [...],
  workingTeamMEP: [...]
}
```

### Weekly Report (Target)
```javascript
{
  resources: {
    manPower: {
      managementTeam: [{
        description: String,
        date: {
          fri: Number,
          sat: Number,
          sun: Number,
          mon: Number,
          tue: Number,
          wed: Number,
          thu: Number
        },
        prevWeek: Number,    // Optional, from previous week
        thisWeek: Number,    // Sum of fri-thu
        accumulated: Number  // Optional, from project start
      }],
      workingTeamInterior: [...],
      workingTeamMEP: [...]
    }
  }
}
```

## Testing

### Unit Test Example

```javascript
const { aggregateManpowerData } = require('../utils/manpowerAggregation');

describe('Manpower Aggregation', () => {
  it('should aggregate daily manpower to weekly format', async () => {
    const result = await aggregateManpowerData(
      'Test Project',
      new Date('2024-06-21'),
      new Date('2024-06-27'),
      { includePrevWeek: false, includeAccumulated: false }
    );

    expect(result.success).toBe(true);
    expect(result.data.manPower).toBeDefined();
    expect(result.data.manPower.managementTeam).toBeInstanceOf(Array);
  });
});
```

## Performance Considerations

1. **Indexing**: Ensure proper indexes on `projectName` and `reportDate` in daily reports
2. **Batch Processing**: Processes all team types in a single database query
3. **Memory Efficiency**: Uses lean queries to minimize memory usage
4. **Caching**: Previous week data is cached when multiple reports are processed

## Troubleshooting

### Common Issues

1. **Empty Results**: Check if daily reports exist for the date range
2. **Incorrect Totals**: Verify `today` field values in daily reports
3. **Missing Descriptions**: Ensure description strings match exactly
4. **Date Issues**: Verify week follows Friday-Thursday structure

### Debug Logging

Enable debug logging by setting:
```bash
DEBUG=manpower:*
```

This will log detailed information about the aggregation process.
