# Daily Report Location-Specific Fixes Summary

## Issue Description
Previously, the Daily Report system had the following issues:
1. If a project had different locations but the same date, the system would update the existing project record instead of creating a new record
2. No location dropdown was available
3. Rolling totals were not location-specific
4. No location filtering for report history

## Changes Made

### 1. Cambodia Locations Data (`src/data/cambodiaLocations.js`)
- Created a new file containing all 25 locations in Cambodia
- Locations include: Phnom Penh, Siem Reap, Sihanoukville, Battambang, Kep, Kampot, Koh Kong, Kandal, Kampong Cham, Pursat, Kampong Chhnang, Takéo, Kampong Speu, Prey Veng, Kampong Thom, Oddar Meanchey, Ratanakiri, Mondulkiri, Preah Vihear, Stung Treng, Kratie, Banteay Meanchey, Pailin, Svay Rieng, Tboung Khmum

### 2. Database Schema Update (`src/models/dailyReportModel.js`)
- **Changed unique index** from `{ userId: 1, projectName: 1, reportDate: 1 }` to `{ userId: 1, projectName: 1, reportDate: 1, location: 1 }`
- This ensures that records are unique per user, project, date, **AND location**
- Now allows multiple records for the same project and date as long as they have different locations

### 3. Service Layer Updates (`src/services/dailyReportService.js`)

#### upsertDailyReport Function
- **Updated existing report query** to include location field
- **Updated previous report query** to include location for proper rolling totals calculation
- **Updated future reports query** to include location for proper recalculation

#### New Function: getReportsByLocation
- Added function to filter reports by location
- Supports optional location parameter (returns all reports if no location specified)

### 4. Controller Updates (`src/controllers/dailyReportController.js`)
- **Added getLocations function** - Returns all 25 Cambodia locations
- **Added getDailyReportsByLocation function** - Filters reports by location
- Imported Cambodia locations data

### 5. Routes Updates (`src/routes/dailyReportRoutes.js`)
- **Added GET /api/daily-reports/locations** - Get all Cambodia locations
- **Added GET /api/daily-reports/by-location** - Get reports filtered by location (with query parameter)
- Updated controller imports

## New API Endpoints

### GET /api/daily-reports/locations
**Response:**
```json
{
  "success": true,
  "locations": ["Phnom Penh", "Siem Reap", "Sihanoukville", ...]
}
```

### GET /api/daily-reports/by-location?location=Phnom Penh
**Response:**
```json
[
  {
    "_id": "...",
    "userId": "...",
    "projectName": "Project A",
    "reportDate": "2026-03-06T00:00:00.000Z",
    "location": "Phnom Penh",
    "activityToday": "Work on foundation - Phnom Penh site",
    ...
  }
]
```

## Behavior Changes

### Before
- Same project + same date = update existing record (regardless of location)
- Rolling totals calculated across all locations
- No location filtering available

### After
- Same project + same date + same location = update existing record
- Same project + same date + different location = create new record
- Rolling totals calculated per location
- Location filtering available for report history

## Testing
Created comprehensive test suite (`test-location-logic.js`) that verifies:
- Cambodia locations data integrity
- Unique index logic
- Location filtering logic
- Location-specific rolling totals
- API endpoint structure
- Frontend integration points

## Frontend Integration Requirements

The frontend should implement:
1. **Location Dropdown** - Use `/api/daily-reports/locations` to populate dropdown with 25 Cambodia locations
2. **Location-Specific Record Creation** - Include selected location when creating/updating reports
3. **Location Filter in History** - Use `/api/daily-reports/by-location` with query parameter for filtering
4. **Location-Based Rolling Totals** - Display rolling totals based on selected location only
5. **Separate History Entries** - Each record with different location displayed separately

## Database Migration
The unique index change will automatically apply to new records. Existing records without a location field will have an empty string as location, and new records with specific locations will be created separately.

## Rollback Plan
If needed, the changes can be rolled back by:
1. Reverting the unique index in `dailyReportModel.js`
2. Removing location-specific queries in `dailyReportService.js`
3. Removing new controller functions and routes
4. Deleting the `cambodiaLocations.js` file

## Testing Commands
```bash
# Run logic tests (no database required)
node test-location-logic.js

# Run full integration tests (requires MongoDB)
node test-location-functionality.js
```
