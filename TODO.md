# Rolling Total System Fixes for Multi-Browser Concurrency

## Backend Fixes

- [x] Add userId to dailyReportModel for unique constraints
- [x] Implement database transactions in dailyReportService
- [x] Create recalculateRollingTotals function that derives Prev from last Accumulate
- [x] Implement forward recalculation when past dates are edited
- [x] Modify saveOrUpdateReport to use minimal frontend data (only today values)
- [x] Add atomic operations to prevent race conditions

## Frontend Fixes

- [ ] Remove accumulated calculation logic from ResourceTable.tsx
- [ ] Make accumulated field read-only in UI
- [ ] Implement debounced auto-save on resource changes
- [ ] Modify frontend to send only today/date/description data
- [ ] Update data loading to handle backend-calculated prev/accumulated

## Testing

- [ ] Test with two browsers logged in as same user
- [ ] Test simultaneous edits on same and different dates
- [ ] Test editing past dates and verify forward recalculations
- [ ] Test page refresh and reconnect scenarios
