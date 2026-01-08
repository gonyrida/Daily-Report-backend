# TODO: Implement Clickable Logos for Report Replacement

## Frontend Changes

- [ ] Modify ReportHeader.tsx to make logos clickable
- [ ] Add hidden file input for logo selection
- [ ] Handle file selection: read as base64, store in localStorage, update img src
- [ ] Load custom logos from localStorage on component mount

## Backend Changes

- [ ] Modify fill_report_header in report.py to insert custom logos if provided in data
- [ ] Update payload structure to include cacpm_logo and koica_logo as base64 data URLs

## Integration Changes

- [ ] Modify reportsApi.ts to include custom logos in payload when generating reports
- [ ] Ensure logos persist across report generations and date changes

## Testing

- [ ] Test logo upload and replacement
- [ ] Test persistence across reloads
- [ ] Test report generation with custom logos
