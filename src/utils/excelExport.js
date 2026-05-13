'use strict';
// Backend Master Weekly Report Excel generator using exceljs.
// Matches the design system colours from weeklyreportpdf.ts.

const ExcelJS = require('exceljs');

// ── Design tokens ──────────────────────────────────────────────────────────────
const SEC_FILL_HEX   = 'FF9BC2E6'; // Section banner / header fill (ARGB)
const TBL_HDR_HEX    = 'FFA6A6A6'; // Table column header
const TBL_ALT_HEX    = 'FFF2F2F2'; // Alternate row
const TOTAL_FILL_HEX = 'FFE2EFDA'; // Total row (light green)
const GRP_FILL_HEX   = 'FFD9E1F2'; // Group header
const WHITE_HEX      = 'FFFFFFFF';

// ── Style helpers ──────────────────────────────────────────────────────────────
const thinBorder = {
  top:    { style: 'thin' },
  left:   { style: 'thin' },
  bottom: { style: 'thin' },
  right:  { style: 'thin' },
};

const applyBorder = (cell) => { cell.border = thinBorder; };

const fillCell = (cell, argbHex) => {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argbHex } };
};

const s = (v) => (v === undefined || v === null ? '' : String(v));

/**
 * Write a header row with SEC_FILL background + bold text.
 * Returns the row object.
 */
const writeSecHeader = (sheet, values, colStart = 1) => {
  const row = sheet.addRow([]);
  values.forEach((val, idx) => {
    const cell = row.getCell(colStart + idx);
    cell.value = val;
    cell.font  = { bold: true, size: 10 };
    fillCell(cell, SEC_FILL_HEX);
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    applyBorder(cell);
  });
  row.height = 18;
  return row;
};

/**
 * Write a table header row with TBL_HDR background.
 */
const writeTblHeader = (sheet, values, colStart = 1) => {
  const row = sheet.addRow([]);
  values.forEach((val, idx) => {
    const cell = row.getCell(colStart + idx);
    cell.value = val;
    cell.font  = { bold: true, size: 9 };
    fillCell(cell, TBL_HDR_HEX);
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    applyBorder(cell);
  });
  row.height = 16;
  return row;
};

/**
 * Write a data row with optional alternation and optional fill override.
 */
const writeDataRow = (sheet, values, opts = {}) => {
  const { alt = false, fillHex = null, bold = false, colStart = 1, align = 'left' } = opts;
  const row = sheet.addRow([]);
  values.forEach((val, idx) => {
    const cell = row.getCell(colStart + idx);
    cell.value = val === undefined || val === null ? '' : val;
    cell.font  = { bold, size: 9 };
    const bg = fillHex || (alt ? TBL_ALT_HEX : WHITE_HEX);
    fillCell(cell, bg);
    cell.alignment = { horizontal: align, vertical: 'middle', wrapText: true };
    applyBorder(cell);
  });
  row.height = 15;
  return row;
};

/** Add an empty spacer row */
const spacer = (sheet) => { sheet.addRow([]); };

// ── Sheet builders ─────────────────────────────────────────────────────────────

function buildSummarySheet(wb, reportData) {
  const sheet = wb.addWorksheet('Summary');

  // Column widths
  sheet.columns = [
    { width: 6  },  // A - No.
    { width: 30 },  // B - Project Name
    { width: 14 },  // C - Status
    { width: 12 },  // D - Progress %
    { width: 12 },  // E - Activities
    { width: 10 },  // F - Issues
  ];

  // Title row
  const titleRow = sheet.addRow(['MASTER WEEKLY PROGRESS REPORT']);
  const titleCell = titleRow.getCell(1);
  titleCell.font  = { bold: true, size: 14, color: { argb: 'FF002060' } };
  titleCell.alignment = { horizontal: 'center' };
  sheet.mergeCells(`A${titleRow.number}:F${titleRow.number}`);
  titleRow.height = 24;

  spacer(sheet);

  // Metadata
  const folderName   = s(reportData.folder && reportData.folder.name);
  const weekNum      = s(reportData.weekNumber);
  const projectCount = (reportData.reports || []).length;
  const weighted     = ((reportData.aggregated && reportData.aggregated.progress && reportData.aggregated.progress.weighted) || 0).toFixed(1) + '%';
  const grandTotal   = s((reportData.aggregated && reportData.aggregated.manpower && reportData.aggregated.manpower.grandTotal) || 0);

  const metaRows = [
    ['Folder:', folderName],
    ['Week:', weekNum],
    ['Projects:', String(projectCount)],
    ['Weighted Progress:', weighted],
    ['Grand Total Manpower:', grandTotal + ' persons'],
  ];
  metaRows.forEach(([label, value]) => {
    const r = sheet.addRow([label, value]);
    r.getCell(1).font = { bold: true, size: 10 };
    r.getCell(2).font = { size: 10 };
  });

  spacer(sheet);

  // Projects table
  writeSecHeader(sheet, ['PROJECT SUMMARIES']);
  sheet.mergeCells(`A${sheet.lastRow.number}:F${sheet.lastRow.number}`);

  writeTblHeader(sheet, ['No.', 'Project Name', 'Status', 'Progress %', 'Activities', 'Issues']);

  (reportData.reports || []).forEach((r, i) => {
    writeDataRow(sheet, [
      i + 1,
      s(r.projectName),
      s(r.status),
      ((r.progress || 0)).toFixed(1) + '%',
      String(r.activityCount || 0),
      String(r.issueCount    || 0),
    ], { alt: i % 2 === 1 });
  });

  // Weighted average callout
  spacer(sheet);
  const wtRow = sheet.addRow(['', 'Weighted Average Progress:', '', weighted, '', '']);
  fillCell(wtRow.getCell(2), TOTAL_FILL_HEX);
  fillCell(wtRow.getCell(4), TOTAL_FILL_HEX);
  wtRow.getCell(2).font = { bold: true, size: 11 };
  wtRow.getCell(4).font = { bold: true, size: 13, color: { argb: 'FF002060' } };

  return sheet;
}

function buildActivitiesSheet(wb, reportData) {
  const sheet = wb.addWorksheet('Activities');

  sheet.columns = [
    { width: 30 }, // A - Project
    { width: 50 }, // B - Description
    { width: 10 }, // C - %
  ];

  // ── This Week ──────────────────────────────────────────────────────────────
  writeSecHeader(sheet, ['THIS WEEK ACTIVITIES']);
  sheet.mergeCells(`A${sheet.lastRow.number}:C${sheet.lastRow.number}`);

  writeTblHeader(sheet, ['Project', 'Description', '%']);

  const weeklyActs = (reportData.aggregated && reportData.aggregated.activities && reportData.aggregated.activities.weeklyActivities) || [];
  weeklyActs.forEach((act, i) => {
    writeDataRow(sheet, [
      s(act.projectSource),
      s(act.description),
      ((act.percent || (act.percentage ? parseFloat(act.percentage) : 0))).toFixed(1) + '%',
    ], { alt: i % 2 === 1 });
  });
  if (!weeklyActs.length) {
    writeDataRow(sheet, ['', 'No activity data.', '']);
  }

  spacer(sheet);

  // ── Next Week ──────────────────────────────────────────────────────────────
  writeSecHeader(sheet, ['NEXT WEEK PLAN']);
  sheet.mergeCells(`A${sheet.lastRow.number}:C${sheet.lastRow.number}`);

  writeTblHeader(sheet, ['Project', 'Description', '%']);

  const nextWeekActs = (reportData.aggregated && reportData.aggregated.activities && reportData.aggregated.activities.nextWeekPlan) || [];
  nextWeekActs.forEach((act, i) => {
    writeDataRow(sheet, [
      s(act.projectSource),
      s(act.description),
      ((act.percent || (act.percentage ? parseFloat(act.percentage) : 0))).toFixed(1) + '%',
    ], { alt: i % 2 === 1 });
  });
  if (!nextWeekActs.length) {
    writeDataRow(sheet, ['', 'No next week plan data.', '']);
  }

  return sheet;
}

function buildIssuesSheet(wb, reportData) {
  const sheet = wb.addWorksheet('Issues');

  sheet.columns = [
    { width: 6  },  // A
    { width: 25 },  // B
    { width: 25 },  // C
    { width: 45 },  // D
    { width: 25 },  // E
  ];

  writeSecHeader(sheet, ['CONSTRUCTION ISSUES']);
  sheet.mergeCells(`A${sheet.lastRow.number}:E${sheet.lastRow.number}`);

  writeTblHeader(sheet, ['No.', 'Project', 'Location', 'Problem', 'Action By']);

  const issues = (reportData.aggregated && reportData.aggregated.issues) || [];
  issues.forEach((iss, i) => {
    writeDataRow(sheet, [
      s(iss.no != null ? iss.no : i + 1),
      s(iss.projectSource),
      s(iss.location),
      s(iss.problem),
      s(iss.actionBy),
    ], { alt: i % 2 === 1 });
  });
  if (!issues.length) {
    writeDataRow(sheet, ['', '', '', 'No construction issues.', '']);
  }

  return sheet;
}

function buildQAQCSheet(wb, reportData) {
  const sheet = wb.addWorksheet('QA-QC');

  sheet.columns = [
    { width: 20 },  // A - Code
    { width: 40 },  // B - Description
    { width: 18 },  // C - Col3
    { width: 18 },  // D - Col4
  ];

  const QAQC_DEFS = [
    { id: '4.1',  title: 'Non-Conformity Report (NCR)',             key: 'ncr',  col3: 'Status',        col4: 'Date Responded'  },
    { id: '4.2',  title: 'Corrective Action Request (CAR)',          key: 'car',  col3: 'Status',        col4: 'Date Responded'  },
    { id: '4.3',  title: 'Safety Corrective Action Request (SCAR)',  key: 'scar', col3: 'Status',        col4: 'Date Responded'  },
    { id: '4.4',  title: 'PM Site Instruction (SI)',                 key: 'pmsi', col3: 'Status',        col4: 'Date Responded'  },
    { id: '4.5',  title: 'Client Site Instruction (SI)',             key: 'csi',  col3: 'Issued By',     col4: 'Issued Date'     },
    { id: '4.6',  title: 'Inspection Request (IR)',                  key: 'ir',   col3: 'Received Date', col4: 'Inspection Date' },
    { id: '4.7',  title: 'Material for Approval (MFA)',              key: 'mfa',  col3: 'Status',        col4: 'Date Responded'  },
    { id: '4.8',  title: 'Request for Information (RFI)',            key: 'rfi',  col3: 'Status',        col4: 'Date Responded'  },
    { id: '4.9',  title: 'Request for Approval (RFA)',               key: 'rfa',  col3: 'Status',        col4: 'Date Responded'  },
    { id: '4.10', title: 'Field Change Request (FCR)',               key: 'fcr',  col3: 'Status',        col4: 'Date Responded'  },
    { id: '4.11', title: 'Variation Order (VO)',                     key: 'vo',   col3: 'Status',        col4: 'Date Responded'  },
    { id: '4.12', title: 'Transmittal (TR)',                         key: 'tr',   col3: 'Status',        col4: 'Date Responded'  },
    { id: '4.13', title: 'Material Inspection Approval (MIR)',       key: 'mir',  col3: 'Status',        col4: 'Date Responded'  },
  ];

  const qaqcStatus = (reportData.aggregated && reportData.aggregated.qaqcStatus) || {};

  // Main title
  writeSecHeader(sheet, ['QA/QC STATUS']);
  sheet.mergeCells(`A${sheet.lastRow.number}:D${sheet.lastRow.number}`);
  spacer(sheet);

  QAQC_DEFS.forEach(def => {
    // Sub-section header
    const secHeaderRow = sheet.addRow([`${def.id}  ${def.title}`, '', '', '']);
    secHeaderRow.getCell(1).font = { bold: true, size: 10 };
    fillCell(secHeaderRow.getCell(1), 'FFDCE6F1');
    [1, 2, 3, 4].forEach(col => applyBorder(secHeaderRow.getCell(col)));
    sheet.mergeCells(`A${secHeaderRow.number}:D${secHeaderRow.number}`);
    secHeaderRow.height = 16;

    writeTblHeader(sheet, ['Code', 'Description', def.col3, def.col4]);

    const sec      = qaqcStatus[def.key] || {};
    const secItems = sec.items || [];

    secItems.forEach((it, i) => {
      let col3Val = '';
      let col4Val = '';
      if (def.id === '4.5') {
        col3Val = s(it.issuedBy   || it.status);
        col4Val = s(it.issuedDate || it.dateResponded);
      } else if (def.id === '4.6') {
        col3Val = s(it.receivedDate   || it.dateResponded);
        col4Val = s(it.inspectionDate);
      } else {
        col3Val = s(it.status);
        col4Val = s(it.dateResponded || it.dateResponse);
      }
      writeDataRow(sheet, [s(it.code), s(it.description || it.comment), col3Val, col4Val], { alt: i % 2 === 1 });
    });

    // Fill minimum 5 rows
    const emptyNeeded = Math.max(0, 5 - secItems.length);
    for (let i = 0; i < emptyNeeded; i++) {
      writeDataRow(sheet, ['', '', '', ''], { alt: (secItems.length + i) % 2 === 1 });
    }

    // Comments row
    const commentRow = sheet.addRow([`Comments: ${s(sec.comments || '')}`, '', '', '']);
    commentRow.getCell(1).font = { size: 9 };
    commentRow.getCell(1).alignment = { wrapText: true };
    [1, 2, 3, 4].forEach(col => applyBorder(commentRow.getCell(col)));
    sheet.mergeCells(`A${commentRow.number}:D${commentRow.number}`);
    commentRow.height = 16;

    spacer(sheet);
  });

  return sheet;
}

function buildHSESheet(wb, reportData) {
  const sheet = wb.addWorksheet('HSE');
  const hses  = (reportData.aggregated && reportData.aggregated.hses) || {};

  // ── 5.1 Training ──────────────────────────────────────────────────────────
  sheet.columns = [
    { width: 25 },
    { width: 14 },
    { width: 20 },
    { width: 20 },
    { width: 12 },
    { width: 25 },
  ];

  writeSecHeader(sheet, ['5.1  HSES Training / Introduction / Toolbox Meeting']);
  sheet.mergeCells(`A${sheet.lastRow.number}:F${sheet.lastRow.number}`);

  writeTblHeader(sheet, ['Type of Training', 'Date', 'Venue', 'Trainer', 'Attendee', 'Remarks']);

  const training = hses.training || [];
  training.forEach((r, i) => {
    writeDataRow(sheet, [s(r.typeOfTraining), s(r.date), s(r.venue), s(r.trainer), s(r.attendee), s(r.remarks)], { alt: i % 2 === 1 });
  });
  const trainingEmpty = Math.max(0, 3 - training.length);
  for (let i = 0; i < trainingEmpty; i++) writeDataRow(sheet, ['', '', '', '', '', '']);

  spacer(sheet);

  // ── 5.2 Inspection ────────────────────────────────────────────────────────
  writeSecHeader(sheet, ['5.2  HSES Inspection / Audit / Heavy Equipment / Hand&Power Tool Checklist']);
  sheet.mergeCells(`A${sheet.lastRow.number}:F${sheet.lastRow.number}`);

  writeTblHeader(sheet, ['Type of Inspection', 'Date', 'Inspector', 'Remarks', '', '']);

  const inspection = hses.inspection || [];
  inspection.forEach((r, i) => {
    writeDataRow(sheet, [s(r.typeOfInspection), s(r.date), s(r.inspector), s(r.remarks), '', ''], { alt: i % 2 === 1 });
  });
  const inspectionEmpty = Math.max(0, 3 - inspection.length);
  for (let i = 0; i < inspectionEmpty; i++) writeDataRow(sheet, ['', '', '', '', '', '']);

  spacer(sheet);

  // ── 5.3 Permits ───────────────────────────────────────────────────────────
  writeSecHeader(sheet, ['5.3  Permit to Work']);
  sheet.mergeCells(`A${sheet.lastRow.number}:F${sheet.lastRow.number}`);

  writeTblHeader(sheet, ['Type of Permit', 'Start Date', 'End Date', 'Inspector', 'Approver', 'Remarks']);

  const permits = hses.permit || [];
  permits.forEach((r, i) => {
    writeDataRow(sheet, [s(r.typeOfPermit), s(r.startDate), s(r.endDate), s(r.inspector), s(r.approver), s(r.remarks)], { alt: i % 2 === 1 });
  });
  const permitEmpty = Math.max(0, 3 - permits.length);
  for (let i = 0; i < permitEmpty; i++) writeDataRow(sheet, ['', '', '', '', '', '']);

  spacer(sheet);

  // ── 5.4 First Aid ─────────────────────────────────────────────────────────
  writeSecHeader(sheet, ['5.4  First Aid / Accident / Incident / Near Miss / Fatalities (if Any)']);
  sheet.mergeCells(`A${sheet.lastRow.number}:F${sheet.lastRow.number}`);

  const firstAidRow = sheet.addRow([s(hses.firstAidAccident || ''), '', '', '', '', '']);
  firstAidRow.getCell(1).alignment = { wrapText: true };
  [1, 2, 3, 4, 5, 6].forEach(col => applyBorder(firstAidRow.getCell(col)));
  sheet.mergeCells(`A${firstAidRow.number}:F${firstAidRow.number}`);
  firstAidRow.height = 30;

  spacer(sheet);

  // ── 5.5 Other Activities ─────────────────────────────────────────────────
  writeSecHeader(sheet, ['5.5  Other HSES Activities Concerns']);
  sheet.mergeCells(`A${sheet.lastRow.number}:F${sheet.lastRow.number}`);

  const otherRow = sheet.addRow([s(hses.otherActivities || ''), '', '', '', '', '']);
  otherRow.getCell(1).alignment = { wrapText: true };
  [1, 2, 3, 4, 5, 6].forEach(col => applyBorder(otherRow.getCell(col)));
  sheet.mergeCells(`A${otherRow.number}:F${otherRow.number}`);
  otherRow.height = 30;

  return sheet;
}

function buildManpowerSheet(wb, reportData) {
  const sheet = wb.addWorksheet('Manpower');
  const mp    = (reportData.aggregated && reportData.aggregated.manpower) || {};

  const DAY_LABELS = ['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'];
  const DAY_KEYS   = ['fri', 'sat', 'sun', 'mon', 'tue', 'wed', 'thu'];

  // 9 columns: Team + 7 days + Total
  sheet.columns = [
    { width: 22 },
    { width: 8 }, { width: 8 }, { width: 8 },
    { width: 8 }, { width: 8 }, { width: 8 }, { width: 8 },
    { width: 10 },
  ];

  writeSecHeader(sheet, ['MANPOWER SUMMARY']);
  sheet.mergeCells(`A${sheet.lastRow.number}:I${sheet.lastRow.number}`);

  // Header rows
  writeTblHeader(sheet, ['Team', ...DAY_LABELS, 'Total']);

  const getDay = (dates, key) => {
    if (!dates) return '';
    const v = dates[key];
    return v === 0 ? 0 : (v || '');
  };

  const teams = [
    { label: 'Management',         dates: mp.managementDates,       total: mp.managementTotal     || 0 },
    { label: 'Working (Interior)', dates: mp.workingInteriorDates,   total: mp.workingInteriorTotal || 0 },
    { label: 'Working (MEP)',       dates: mp.workingMEPDates,        total: mp.workingMEPTotal     || 0 },
  ];

  teams.forEach(team => {
    const vals = [team.label, ...DAY_KEYS.map(k => getDay(team.dates, k)), team.total];
    const row  = writeDataRow(sheet, vals, { fillHex: GRP_FILL_HEX, bold: true });
    row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
  });

  // Grand total
  const totalVals = ['Grand Total', ...DAY_KEYS.map(() => ''), mp.grandTotal || 0];
  writeDataRow(sheet, totalVals, { fillHex: TOTAL_FILL_HEX, bold: true });

  spacer(sheet);

  // ── Resources detailed breakdown (if available) ────────────────────────────
  const resources = reportData.aggregated && reportData.aggregated.resources;
  if (resources && resources.manPower) {
    writeSecHeader(sheet, ['MANPOWER DETAILS']);
    sheet.mergeCells(`A${sheet.lastRow.number}:I${sheet.lastRow.number}`);

    const renderTeam = (label, rows) => {
      const grpRow = sheet.addRow([label, '', '', '', '', '', '', '', '']);
      grpRow.getCell(1).font = { bold: true, size: 9 };
      fillCell(grpRow.getCell(1), GRP_FILL_HEX);
      [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach(col => applyBorder(grpRow.getCell(col)));
      sheet.mergeCells(`A${grpRow.number}:I${grpRow.number}`);

      writeTblHeader(sheet, ['Description', ...DAY_LABELS, 'Total']);

      (rows || []).forEach((r, i) => {
        const daily = Array.isArray(r.dailyData) ? r.dailyData : Array.isArray(r.daily) ? r.daily : Array(7).fill('');
        writeDataRow(sheet, [
          s(r.description),
          ...daily.slice(0, 7).map(v => v === 0 ? 0 : (v || '')),
          r.thisWeek || r.total || '',
        ], { alt: i % 2 === 1 });
      });
    };

    renderTeam('Management Team',       resources.manPower.managementTeam);
    spacer(sheet);
    renderTeam('Working Team (Interior)', resources.manPower.workingTeamInterior);
    spacer(sheet);
    renderTeam('Working Team (MEP)',      resources.manPower.workingTeamMEP);
  }

  return sheet;
}

// ── Main generator ─────────────────────────────────────────────────────────────
/**
 * Generate Master Weekly Report Excel workbook.
 * @param {object} reportData - The master report data object
 * @returns {Promise<Buffer>}
 */
async function generateMasterReportExcel(reportData) {
  const wb = new ExcelJS.Workbook();

  wb.creator    = 'CACPM Report System';
  wb.lastModifiedBy = 'CACPM Report System';
  wb.created    = new Date();
  wb.modified   = new Date();
  wb.properties.date1904 = false;

  buildSummarySheet(wb, reportData);
  buildActivitiesSheet(wb, reportData);
  buildIssuesSheet(wb, reportData);
  buildQAQCSheet(wb, reportData);
  buildHSESheet(wb, reportData);
  buildManpowerSheet(wb, reportData);

  const buffer = await wb.xlsx.writeBuffer();
  return buffer;
}

module.exports = {
  generateMasterReportExcel,
  exportToExcel: generateMasterReportExcel,
};
