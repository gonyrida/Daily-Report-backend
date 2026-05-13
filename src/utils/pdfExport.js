'use strict';
// Backend master report PDF generator using pdfmake (Node.js)
// Matches the template styling from frontend weeklyreportpdf.ts

const pdfMake = require('pdfmake/build/pdfmake');
const pdfFonts = require('pdfmake/build/vfs_fonts');
pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts.vfs;

// ── Helpers ────────────────────────────────────────────────────────────────────
const s = (v) => (v === undefined || v === null ? '' : String(v));

// ── Design tokens ──────────────────────────────────────────────────────────────
const SEC_FILL   = '#9BC2E6';
const TBL_HDR    = '#A6A6A6';
const TBL_ALT    = '#F2F2F2';
const GRP_FILL   = '#D9E1F2';
const TOTAL_FILL = '#E2EFDA';
const LOC_FILL   = '#D6DCE4';
const QAQC_FILL  = '#DCE6F1';

// ── Layout helpers ─────────────────────────────────────────────────────────────
const secBanner = (title, mt = 0) => ({
  table: { widths: ['*'], body: [[{ text: title, style: 'secBanner', fillColor: SEC_FILL }]] },
  layout: { defaultBorder: false },
  margin: [0, mt, 0, 14],
});

const subHdr = (text, mt = 8) => ({
  text,
  style: 'subHdr',
  margin: [0, mt, 0, 4],
});

const pb = () => ({ text: '', pageBreak: 'after' });

const mkTable = (headers, rows, opts = {}) => {
  const hFill   = opts.hFill !== undefined ? opts.hFill : TBL_HDR;
  const altRows = opts.altRows !== false;
  const fSize   = opts.compact ? 8 : 9;

  const headerRow = headers.map(h => {
    if (!h) return {};
    return {
      text: h.text,
      style: 'tblHdr',
      fontSize: fSize,
      fillColor: hFill,
      alignment: h.align || 'center',
      ...(h.colSpan ? { colSpan: h.colSpan } : {}),
    };
  });

  const body = [headerRow];

  rows.forEach((row, ri) => {
    const alt = altRows && ri % 2 === 1;
    body.push(
      row.map(cell => {
        if (cell === null) return {};
        return {
          text: cell.text,
          style: 'tblCell',
          fontSize: fSize,
          fillColor: cell.fill || (alt ? TBL_ALT : '#FFFFFF'),
          alignment: cell.align || 'left',
          ...(cell.colSpan ? { colSpan: cell.colSpan } : {}),
          ...(cell.bold ? { bold: true } : {}),
          ...(cell.margin ? { margin: cell.margin } : {}),
        };
      }),
    );
  });

  return {
    table: {
      headerRows: 1,
      widths: headers.map(h => (h && h.w !== undefined ? h.w : 'auto')),
      body,
    },
    layout: {
      hLineWidth: (r, n) => (r === 0 || r === n.table.body.length) ? 1 : 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => '#000000',
      vLineColor: () => '#000000',
    },
  };
};

// ── QAQC definitions ───────────────────────────────────────────────────────────
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

// ── SECTION BUILDERS ───────────────────────────────────────────────────────────

function buildCover(reportData, companyLogoDataUrl) {
  const projectCount = (reportData.reports || []).length;
  const weighted     = ((reportData.aggregated && reportData.aggregated.progress && reportData.aggregated.progress.weighted) || 0).toFixed(1) + '%';
  const grandTotal   = (reportData.aggregated && reportData.aggregated.manpower && reportData.aggregated.manpower.grandTotal) || 0;
  const folderName   = s(reportData.folder && reportData.folder.name);
  const weekNum      = s(reportData.weekNumber);

  return [
    {
      table: {
        widths: [10, 6, '*'],
        body: [
          [
            { text: '', fillColor: '#16365C', border: [false, false, false, false], rowSpan: 3 },
            { text: '', fillColor: '#FFFFFF',  border: [false, false, false, false], rowSpan: 3 },
            {
              stack: [
                {
                  columns: [
                    { width: 120, stack: companyLogoDataUrl ? [{ image: companyLogoDataUrl, width: 90 }] : [] },
                    { width: '*', text: '' },
                  ],
                  columnGap: 10,
                },
                {
                  table: {
                    widths: ['*'],
                    body: [[{
                      text: 'MASTER WEEKLY PROGRESS REPORT',
                      style: 'coverTitleBanner',
                      fillColor: '#002060',
                      color: '#FFFFFF',
                      alignment: 'center',
                    }]],
                  },
                  layout: { defaultBorder: false },
                  margin: [0, 60, 0, 12],
                },
                { text: `Week - ${weekNum}`, style: 'coverWeek' },
                {
                  table: {
                    widths: [130, 12, '*'],
                    body: [
                      [{ text: 'Folder',            style: 'partyLabel' }, { text: ':', style: 'partyLabel' }, { text: folderName,                      style: 'partyValue' }],
                      [{ text: 'Week',              style: 'partyLabel' }, { text: ':', style: 'partyLabel' }, { text: weekNum,                         style: 'partyValue' }],
                      [{ text: 'Projects',          style: 'partyLabel' }, { text: ':', style: 'partyLabel' }, { text: String(projectCount),            style: 'partyValue' }],
                      [{ text: 'Weighted Progress', style: 'partyLabel' }, { text: ':', style: 'partyLabel' }, { text: weighted,                        style: 'partyValue' }],
                      [{ text: 'Grand Total MP',    style: 'partyLabel' }, { text: ':', style: 'partyLabel' }, { text: String(grandTotal) + ' persons', style: 'partyValue' }],
                    ],
                  },
                  layout: { defaultBorder: false },
                  margin: [0, 40, 0, 0],
                },
              ],
              margin: [14, 14, 14, 14],
            },
          ],
          [
            {}, {},
            {
              stack: (reportData.reports || []).map(r => ({
                text: `• ${s(r.projectName)}   [${((r.progress || 0)).toFixed(1)}%]`,
                style: 'bodyText',
                margin: [14, 1, 14, 1],
              })),
              margin: [14, 10, 14, 10],
            },
          ],
          [{}, {}, { text: '', margin: [0, 20, 0, 0] }],
        ],
      },
      layout: { defaultBorder: false },
    },
  ];
}

function buildProjectSummaries(reportData) {
  const items = [secBanner('1.  PROJECT SUMMARIES')];

  const rows = (reportData.reports || []).map((r, i) => [
    { text: String(i + 1),                        align: 'center' },
    { text: s(r.projectName),                     align: 'left'   },
    { text: s(r.status),                          align: 'center' },
    { text: ((r.progress || 0)).toFixed(1) + '%', align: 'center' },
    { text: String(r.activityCount || 0),         align: 'center' },
    { text: String(r.issueCount || 0),            align: 'center' },
  ]);

  items.push(mkTable(
    [
      { text: 'No.',          w: 30  },
      { text: 'Project Name', w: '*' },
      { text: 'Status',       w: 70  },
      { text: 'Progress %',   w: 60  },
      { text: 'Activities',   w: 55  },
      { text: 'Issues',       w: 45  },
    ],
    rows.length ? rows : [[{ text: 'No project data.', colSpan: 6, align: 'center' }, null, null, null, null, null]],
    { hFill: SEC_FILL, altRows: true },
  ));

  const weighted = ((reportData.aggregated && reportData.aggregated.progress && reportData.aggregated.progress.weighted) || 0).toFixed(1);
  items.push({
    table: {
      widths: ['*'],
      body: [[{
        text: [
          { text: 'Weighted Average Progress: ', bold: true, fontSize: 11 },
          { text: weighted + '%', bold: true, fontSize: 14, color: '#002060' },
        ],
        fillColor: TOTAL_FILL,
        alignment: 'center',
        margin: [0, 8, 0, 8],
      }]],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => '#000000',
      vLineColor: () => '#000000',
    },
    margin: [0, 8, 0, 0],
  });

  return items;
}

function buildActivities(reportData) {
  const items = [secBanner('2.  ACTIVITIES OF WORK DONE / NEXT WEEK PLAN')];

  const weeklyActs   = (reportData.aggregated && reportData.aggregated.activities && reportData.aggregated.activities.weeklyActivities) || [];
  const nextWeekActs = (reportData.aggregated && reportData.aggregated.activities && reportData.aggregated.activities.nextWeekPlan) || [];
  const fSize = 9;

  const headerRow = [
    { text: 'Activities of Work Done', bold: true, fontSize: fSize, fillColor: SEC_FILL, alignment: 'center', colSpan: 2 },
    {},
    { text: 'Next Week Plan', bold: true, fontSize: fSize, fillColor: SEC_FILL, alignment: 'center', colSpan: 2 },
    {},
  ];

  const projectNames = [...new Set([
    ...weeklyActs.map(a => a.projectSource),
    ...nextWeekActs.map(a => a.projectSource),
  ])];

  const dataRows = [];

  if (projectNames.length === 0) {
    dataRows.push([
      { text: 'No activity data available.', colSpan: 4, alignment: 'center', style: 'tblCell', fontSize: fSize },
      {}, {}, {},
    ]);
  } else {
    projectNames.forEach(proj => {
      dataRows.push([
        { text: proj, bold: true, fontSize: fSize, fillColor: GRP_FILL, colSpan: 4, alignment: 'left', margin: [4, 3, 4, 3] },
        {}, {}, {},
      ]);

      const projWeekly   = weeklyActs.filter(a => a.projectSource === proj);
      const projNextWeek = nextWeekActs.filter(a => a.projectSource === proj);
      const maxLen = Math.max(projWeekly.length, projNextWeek.length, 1);

      for (let i = 0; i < maxLen; i++) {
        const wa  = projWeekly[i];
        const nw  = projNextWeek[i];
        const waPct = wa ? (wa.percent || (wa.percentage ? parseFloat(wa.percentage) : 0)) : 0;
        const nwPct = nw ? (nw.percent || (nw.percentage ? parseFloat(nw.percentage) : 0)) : 0;

        dataRows.push([
          { text: wa ? s(wa.description) : '', style: 'tblCell', fontSize: fSize, alignment: 'left', margin: [4, 2, 2, 2] },
          { text: wa ? waPct.toFixed(1) + '%' : '', style: 'tblCell', fontSize: fSize, alignment: 'center' },
          { text: nw ? s(nw.description) : '', style: 'tblCell', fontSize: fSize, alignment: 'left', margin: [4, 2, 2, 2] },
          { text: nw ? nwPct.toFixed(1) + '%' : '', style: 'tblCell', fontSize: fSize, alignment: 'center' },
        ]);
      }
    });
  }

  items.push({
    table: {
      headerRows: 1,
      widths: ['*', 45, '*', 45],
      body: [headerRow, ...dataRows],
    },
    layout: {
      hLineWidth: (i, node) => i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5,
      vLineWidth: (i) => (i === 1 || i === 3) ? 0 : 0.5,
      hLineColor: () => '#000000',
      vLineColor: () => '#000000',
    },
  });

  return items;
}

function buildIssues(reportData) {
  const items = [secBanner('3.  CONSTRUCTION ISSUES')];

  items.push({
    table: {
      widths: ['*'],
      body: [[{
        text: 'Construction Issue',
        bold: true,
        fontSize: 12,
        fillColor: SEC_FILL,
        alignment: 'center',
        margin: [0, 6, 0, 6],
      }]],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => '#000000',
      vLineColor: () => '#000000',
    },
    margin: [0, 0, 0, 0],
  });

  const issues = (reportData.aggregated && reportData.aggregated.issues) || [];
  const issueRows = issues.map((iss, i) => [
    { text: s(iss.no != null ? iss.no : i + 1), align: 'center' },
    { text: s(iss.projectSource),               align: 'left'   },
    { text: s(iss.location),                    align: 'left'   },
    { text: s(iss.problem),                     align: 'left'   },
    { text: s(iss.actionBy),                    align: 'left'   },
  ]);

  items.push(mkTable(
    [
      { text: 'No.',       w: 30  },
      { text: 'Project',   w: 100 },
      { text: 'Location',  w: 80  },
      { text: 'Problem',   w: '*' },
      { text: 'Action By', w: 80  },
    ],
    issueRows.length ? issueRows : [[{ text: 'No construction issues.', colSpan: 5, align: 'center' }, null, null, null, null]],
    { hFill: SEC_FILL, altRows: true },
  ));

  const issuesToRender = issues.slice(0, 4);
  const emptySlotsNeeded = Math.max(0, 4 - issuesToRender.length);
  const allSlots = [
    ...issuesToRender,
    ...Array(emptySlotsNeeded).fill(null).map((_, i) => ({ no: issuesToRender.length + i + 1 })),
  ];

  const tableBody = [];
  allSlots.forEach((issue, i) => {
    const issueNum = (issue && issue.no != null) ? issue.no : i + 1;

    tableBody.push([
      { text: String(issueNum), bold: true, fontSize: 11, decoration: 'underline', alignment: 'left', margin: [4, 4, 4, 4], colSpan: 2 },
      null,
    ]);

    tableBody.push([
      {
        text: [
          { text: 'Project: ', bold: true },
          { text: s(issue && issue.projectSource) },
          { text: '   Site Location: ', bold: true },
          { text: s(issue && issue.location) },
        ],
        fontSize: 10,
        alignment: 'left',
        margin: [4, 4, 4, 4],
      },
      { text: 'Photo Reference', fontSize: 10, alignment: 'center', margin: [4, 4, 4, 4] },
    ]);

    const hasPhoto = issue && issue.photo && issue.photo.startsWith('data:');
    const photoCell = hasPhoto
      ? { image: issue.photo, fit: [240, 200], alignment: 'center' }
      : { text: '', alignment: 'center', margin: [0, 100, 0, 100] };

    tableBody.push([
      {
        stack: [
          { text: 'Problems / Descriptions:', fontSize: 10, margin: [0, 0, 0, 6] },
          { text: s(issue && issue.problem ? issue.problem : ''), fontSize: 10, alignment: 'left' },
        ],
        margin: [4, 4, 4, 4],
      },
      { stack: [photoCell], margin: [4, 4, 4, 4], alignment: 'center' },
    ]);

    tableBody.push([
      { text: `Action by: ${s(issue && issue.actionBy ? issue.actionBy : '')}`, fontSize: 10, alignment: 'left', margin: [4, 4, 4, 4] },
      { text: '', margin: [4, 4, 4, 4] },
    ]);
  });

  items.push({
    table: { widths: ['*', '*'], body: tableBody },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => '#000000',
      vLineColor: () => '#000000',
    },
    margin: [0, 8, 0, 0],
  });

  return items;
}

function buildQAQC(reportData) {
  const items = [];
  const mainBanner = secBanner('4.  QA/QC STATUS');
  mainBanner.pageBreak = 'before';
  items.push(mainBanner);

  const qaqcStatus = (reportData.aggregated && reportData.aggregated.qaqcStatus) || {};

  QAQC_DEFS.forEach((def, index) => {
    if (index > 0 && index % 3 === 0) {
      const cont = secBanner('4.  QA/QC STATUS (Continued)');
      cont.pageBreak = 'before';
      items.push(cont);
    }

    const sec      = qaqcStatus[def.key] || {};
    const secItems = sec.items || [];

    const subTitle = {
      table: {
        widths: ['*'],
        body: [[{
          text: [{ text: `${def.id}  `, bold: true }, { text: def.title }],
          style: 'qaqcSubTitle',
          fillColor: QAQC_FILL,
        }]],
      },
      layout: { defaultBorder: false },
      margin: [0, 8, 0, 2],
    };

    const qRows = secItems.map(it => {
      let col3Val = '';
      let col4Val = '';

      if (def.id === '4.5') {
        col3Val = s(it.issuedBy || it.status);
        col4Val = s(it.issuedDate || it.dateResponded);
      } else if (def.id === '4.6') {
        col3Val = s(it.receivedDate || it.dateResponded);
        col4Val = s(it.inspectionDate);
      } else {
        col3Val = s(it.status);
        col4Val = s(it.dateResponded || it.dateResponse);
      }

      return [
        { text: s(it.code),                        align: 'center' },
        { text: s(it.description || it.comment),   align: 'left'   },
        { text: col3Val,                           align: 'center' },
        { text: col4Val,                           align: 'center' },
      ];
    });

    const emptyRowsNeeded = Math.max(0, 5 - qRows.length);
    const emptyRows = Array(emptyRowsNeeded).fill(null).map(() => [
      { text: '', align: 'center' },
      { text: '', align: 'left'   },
      { text: '', align: 'center' },
      { text: '', align: 'center' },
    ]);

    const table = mkTable(
      [
        { text: 'Code',        w: 125 },
        { text: 'Description', w: 200 },
        { text: def.col3,      w: 75  },
        { text: def.col4,      w: 75  },
      ],
      [...qRows, ...emptyRows],
      { hFill: SEC_FILL, altRows: false },
    );

    const comments = sec.comments || '';
    const commentsRow = {
      table: {
        widths: ['*'],
        body: [[{
          text: [
            { text: 'Comments: ', bold: true, decoration: 'underline' },
            { text: comments },
          ],
          style: 'tblCell',
          fontSize: 9,
          margin: [4, 8, 4, 8],
          alignment: 'left',
        }]],
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => '#000000',
        vLineColor: () => '#000000',
      },
      margin: [0, 0, 0, 0],
    };

    items.push({ stack: [subTitle, table, commentsRow], pageBreak: 'avoid', margin: [0, 0, 0, 10] });
  });

  return items;
}

function buildHSES(reportData) {
  const items = [secBanner('5.  HEALTH, SAFETY, ENVIRONMENTAL & SECURITY (HSES)')];
  const hses  = (reportData.aggregated && reportData.aggregated.hses) || {};

  // 5.1 Training
  items.push(subHdr('5.1  HSES Training / Introduction / Toolbox Meeting', 0));
  const trainingRows = (hses.training || []).map(r => [
    { text: s(r.typeOfTraining)                  },
    { text: s(r.date),    align: 'center' },
    { text: s(r.venue)                           },
    { text: s(r.trainer)                         },
    { text: s(r.attendee), align: 'center' },
    { text: s(r.remarks)                         },
  ]);
  const trainingEmpty = Array(Math.max(0, 3 - trainingRows.length)).fill(null).map(() => [
    { text: '', align: 'left'   },
    { text: '', align: 'center' },
    { text: '', align: 'left'   },
    { text: '', align: 'left'   },
    { text: '', align: 'center' },
    { text: '', align: 'left'   },
  ]);
  items.push(mkTable(
    [
      { text: 'Type of Training', w: '*' },
      { text: 'Date',             w: 55  },
      { text: 'Venue',            w: 70  },
      { text: 'Trainer',          w: 70  },
      { text: 'Attendee',         w: 50  },
      { text: 'Remarks',          w: 80  },
    ],
    [...trainingRows, ...trainingEmpty],
    { hFill: SEC_FILL, altRows: false },
  ));

  // 5.2 Inspection
  items.push(subHdr('5.2  HSES Inspection / Audit / Heavy Equipment / Hand&Power Tool Checklist'));
  const inspectionRows = (hses.inspection || []).map(r => [
    { text: s(r.typeOfInspection)                },
    { text: s(r.date),    align: 'center' },
    { text: s(r.inspector)                       },
    { text: s(r.remarks)                         },
  ]);
  const inspectionEmpty = Array(Math.max(0, 3 - inspectionRows.length)).fill(null).map(() => [
    { text: '', align: 'left'   },
    { text: '', align: 'center' },
    { text: '', align: 'left'   },
    { text: '', align: 'left'   },
  ]);
  items.push(mkTable(
    [
      { text: 'Type of Inspection', w: '*'  },
      { text: 'Date',               w: 55   },
      { text: 'Inspector',          w: 80   },
      { text: 'Remarks',            w: 100  },
    ],
    [...inspectionRows, ...inspectionEmpty],
    { hFill: SEC_FILL, altRows: false },
  ));

  // 5.3 Permits
  items.push(subHdr('5.3  Permit to Work'));
  const permitRows = (hses.permit || []).map(r => [
    { text: s(r.typeOfPermit)                    },
    { text: s(r.startDate), align: 'center' },
    { text: s(r.endDate),   align: 'center' },
    { text: s(r.inspector)                       },
    { text: s(r.approver)                        },
    { text: s(r.remarks)                         },
  ]);
  const permitEmpty = Array(Math.max(0, 3 - permitRows.length)).fill(null).map(() => [
    { text: '', align: 'left'   },
    { text: '', align: 'center' },
    { text: '', align: 'center' },
    { text: '', align: 'left'   },
    { text: '', align: 'left'   },
    { text: '', align: 'left'   },
  ]);
  items.push(mkTable(
    [
      { text: 'Type of Permit', w: '*' },
      { text: 'Start Date',     w: 55  },
      { text: 'End Date',       w: 55  },
      { text: 'Inspector',      w: 65  },
      { text: 'Approver',       w: 65  },
      { text: 'Remarks',        w: 75  },
    ],
    [...permitRows, ...permitEmpty],
    { hFill: SEC_FILL, altRows: false },
  ));

  // 5.4 First Aid
  items.push(subHdr('5.4  First Aid / Accident / Incident / Near Miss / Fatalities (if Any)'));
  items.push({
    stack: [
      { text: s(hses.firstAidAccident || ''), style: 'bodyText' },
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineColor: '#000000', lineWidth: 0.5, lineDash: [1, 1] }],
        margin: [0, 4, 0, 0],
      },
    ],
    margin: [0, 0, 0, 8],
  });

  // 5.5 Other Activities
  items.push(subHdr('5.5  Other HSES Activities Concerns'));
  items.push({
    stack: [
      { text: s(hses.otherActivities || ''), style: 'bodyText' },
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineColor: '#000000', lineWidth: 0.5, lineDash: [1, 1] }],
        margin: [0, 4, 0, 0],
      },
    ],
    margin: [0, 0, 0, 8],
  });

  // 5.6 HSE Photo Reference (data: URLs only in backend)
  const hseRefs = hses.hsePhotoReferences || {};
  const tb = hseRefs.hseToolboxMeeting || [];
  const ap = hseRefs.hseActivityPhotos || [];

  if (tb.length || ap.length) {
    items.push(subHdr('5.6  HSES Photo Reference'));

    const createPhotoBox = (img, desc) => {
      const isDataUrl = img && img.startsWith('data:');
      const photoCell = isDataUrl
        ? { stack: [{ image: img, fit: [230, 150], alignment: 'center' }], margin: [2, 2, 2, 2], alignment: 'center', minHeight: 100 }
        : { text: '', margin: [0, 50, 0, 50] };

      return {
        table: {
          widths: ['*'],
          heights: [100, 18],
          body: [
            [photoCell],
            [{ text: desc || '', style: 'photoCaption', alignment: 'center', fontSize: 9, margin: [2, 3, 2, 3] }],
          ],
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#000000',
          vLineColor: () => '#000000',
        },
      };
    };

    const createPhotoHeader = (title) => ({
      table: {
        widths: ['*'],
        body: [[{ text: title, bold: true, fontSize: 11, fillColor: SEC_FILL, alignment: 'center', margin: [0, 5, 0, 5] }]],
      },
      layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => '#000000', vLineColor: () => '#000000' },
      margin: [0, 8, 0, 0],
    });

    const renderPhotoGroup = (headerText, sections) => {
      if (!sections.length) return;
      const flat = [];
      sections.forEach(section => {
        (section.entries || []).forEach(entry => {
          (entry.slots || []).forEach(slot => {
            flat.push({ img: slot.image, desc: slot.caption || '' });
          });
        });
      });
      if (!flat.length) return;
      items.push(createPhotoHeader(headerText));
      for (let i = 0; i < flat.length; i += 2) {
        const left  = flat[i];
        const right = flat[i + 1];
        items.push({
          columns: [
            createPhotoBox(left.img, left.desc),
            right ? createPhotoBox(right.img, right.desc) : { text: '', width: '*' },
          ],
          columnGap: 0,
          margin: [0, 0, 0, 0],
        });
      }
    };

    renderPhotoGroup('HSE Toolbox Meeting', tb);
    renderPhotoGroup('HSE Activity Photo', ap);
  }

  return items;
}

function buildManpower(reportData) {
  const items = [secBanner('6.  MANPOWER SUMMARY')];
  const mp    = (reportData.aggregated && reportData.aggregated.manpower) || {};

  const DAY_LABELS = ['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'];
  const DAY_KEYS   = ['fri', 'sat', 'sun', 'mon', 'tue', 'wed', 'thu'];
  const fSize = 9;

  const headerRow1 = [
    { text: 'Team',         bold: true, fontSize: fSize, fillColor: SEC_FILL, alignment: 'center' },
    { text: 'Daily Counts', bold: true, fontSize: fSize, fillColor: SEC_FILL, alignment: 'center', colSpan: 7 },
    '', '', '', '', '',
    { text: 'Total',        bold: true, fontSize: fSize, fillColor: SEC_FILL, alignment: 'center' },
  ];
  const headerRow2 = [
    { text: '', bold: true, fontSize: fSize, fillColor: SEC_FILL, alignment: 'center' },
    ...DAY_LABELS.map(d => ({ text: d, bold: true, fontSize: fSize, fillColor: SEC_FILL, alignment: 'center' })),
    { text: '', bold: true, fontSize: fSize, fillColor: SEC_FILL, alignment: 'center' },
  ];

  const getDay = (dates, key) => {
    if (!dates) return '';
    const v = dates[key];
    return v === 0 ? '0' : (v ? String(v) : '');
  };

  const teamRows = [
    [
      { text: 'Management',         bold: true, fontSize: fSize, fillColor: GRP_FILL },
      ...DAY_KEYS.map(k => ({ text: getDay(mp.managementDates, k),    fontSize: fSize, alignment: 'center' })),
      { text: String(mp.managementTotal    || 0), bold: true, fontSize: fSize, alignment: 'center', fillColor: GRP_FILL },
    ],
    [
      { text: 'Working (Interior)', bold: true, fontSize: fSize, fillColor: GRP_FILL },
      ...DAY_KEYS.map(k => ({ text: getDay(mp.workingInteriorDates, k), fontSize: fSize, alignment: 'center' })),
      { text: String(mp.workingInteriorTotal || 0), bold: true, fontSize: fSize, alignment: 'center', fillColor: GRP_FILL },
    ],
    [
      { text: 'Working (MEP)',       bold: true, fontSize: fSize, fillColor: GRP_FILL },
      ...DAY_KEYS.map(k => ({ text: getDay(mp.workingMEPDates, k),    fontSize: fSize, alignment: 'center' })),
      { text: String(mp.workingMEPTotal    || 0), bold: true, fontSize: fSize, alignment: 'center', fillColor: GRP_FILL },
    ],
    [
      { text: 'Grand Total',        bold: true, fontSize: fSize, fillColor: TOTAL_FILL },
      ...DAY_KEYS.map(() => ({ text: '', fontSize: fSize, alignment: 'center', fillColor: TOTAL_FILL })),
      { text: String(mp.grandTotal         || 0), bold: true, fontSize: fSize, alignment: 'center', fillColor: TOTAL_FILL },
    ],
  ];

  items.push({
    table: {
      widths: ['*', 30, 30, 30, 30, 30, 30, 30, 50],
      body: [headerRow1, headerRow2, ...teamRows],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => '#000000',
      vLineColor: () => '#000000',
    },
    margin: [0, 0, 0, 10],
  });

  return items;
}

function buildSitePhotos(reportData) {
  const items = [secBanner('7.  SITE PHOTOS')];

  const photosRecord = (reportData.aggregated && reportData.aggregated.photos) || {};
  const projectNames = Object.keys(photosRecord);

  if (projectNames.length === 0) {
    items.push({ text: 'No site photos available.', style: 'bodyText' });
    return items;
  }

  const createPhotoBox = (img, desc) => {
    const isDataUrl = img && img.startsWith('data:');
    const photoCell = isDataUrl
      ? { stack: [{ image: img, fit: [230, 150], alignment: 'center' }], margin: [2, 2, 2, 2], alignment: 'center', minHeight: 100 }
      : { text: '', margin: [0, 50, 0, 50] };

    return {
      table: {
        widths: ['*'],
        heights: [100, 18],
        body: [
          [photoCell],
          [{ text: desc || '', style: 'photoCaption', alignment: 'center', fontSize: 9, margin: [2, 3, 2, 3] }],
        ],
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => '#000000',
        vLineColor: () => '#000000',
      },
    };
  };

  const createBanner = (title, fill) => ({
    table: {
      widths: ['*'],
      body: [[{ text: title, bold: true, fontSize: 11, fillColor: fill, alignment: 'center', margin: [0, 5, 0, 5] }]],
    },
    layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => '#000000', vLineColor: () => '#000000' },
    margin: [0, 8, 0, 0],
  });

  projectNames.forEach(projName => {
    items.push(createBanner(projName, SEC_FILL));
    const locations = photosRecord[projName] || [];

    locations.forEach(loc => {
      const locTitle = loc.location || loc.title || 'Photos';
      items.push(createBanner(locTitle, LOC_FILL));

      const flat = [];
      (loc.entries || []).forEach(entry => {
        (entry.slots || []).forEach(slot => {
          flat.push({ img: slot.image, desc: slot.caption || '' });
        });
      });

      for (let i = 0; i < flat.length; i += 2) {
        const left  = flat[i];
        const right = flat[i + 1];
        items.push({
          columns: [
            createPhotoBox(left.img, left.desc),
            right ? createPhotoBox(right.img, right.desc) : { text: '', width: '*' },
          ],
          columnGap: 0,
          margin: [0, 0, 0, 0],
        });
      }
    });
  });

  return items;
}

// ── Main generator ─────────────────────────────────────────────────────────────
/**
 * Generate Master Weekly Report PDF on the server.
 * Images should be passed as base64 data: URLs inside reportData if needed.
 * @param {object} reportData - The master report data object
 * @param {string} [companyLogoDataUrl] - Optional base64 data: URL for company logo
 * @returns {Promise<Buffer>}
 */
function generateMasterReportPdf(reportData, companyLogoDataUrl) {
  return new Promise((resolve, reject) => {
    try {
      const content = [
        ...buildCover(reportData, companyLogoDataUrl),
        pb(),
        ...buildProjectSummaries(reportData),
        pb(),
        ...buildActivities(reportData),
        pb(),
        ...buildIssues(reportData),
        ...buildQAQC(reportData),
        pb(),
        ...buildHSES(reportData),
        pb(),
        ...buildManpower(reportData),
        pb(),
        ...buildSitePhotos(reportData),
      ];

      const docDefinition = {
        pageSize: { width: 617.28, height: 786.89 },
        pageMargins: [50, 50, 50, 50],
        info: { title: 'Master Weekly Progress Report' },
        content,
        styles: {
          coverTitleBanner:  { fontSize: 16, bold: true, color: '#FFFFFF', alignment: 'center' },
          coverWeek:         { fontSize: 14, bold: true, color: '#000000', alignment: 'center' },
          coverDateRange:    { fontSize: 10, bold: true, color: '#000000', alignment: 'center' },
          coverProjectTitle: { fontSize: 14, bold: true, italics: true, alignment: 'center', margin: [0, 2, 0, 2] },
          coverPlaceholder:  { fontSize: 12, italics: true, color: '#FFFFFF', alignment: 'center', margin: [0, 80, 0, 80] },
          partyLabel:        { fontSize: 12, bold: true, color: '#000000', alignment: 'left' },
          partyValue:        { fontSize: 12, bold: true, alignment: 'left' },
          pageHdrLeft:       { fontSize: 9, bold: true, color: '#1F2937' },
          pageHdrRight:      { fontSize: 9, color: '#4B5563' },
          pageFooter:        { fontSize: 8, color: '#6B7280' },
          secBanner:         { fontSize: 12, bold: true, color: '#000000', margin: [5, 5, 5, 5] },
          subHdr:            { fontSize: 13, bold: true, color: '#000000' },
          tblHdr:            { fontSize: 9, bold: true, color: '#000000', margin: [2, 3, 2, 3] },
          tblCell:           { fontSize: 9, margin: [2, 2, 2, 2] },
          qaqcSubTitle:      { fontSize: 10, margin: [4, 4, 4, 4] },
          bodyText:          { fontSize: 10, lineHeight: 1.35 },
          photoLocBanner:    { fontSize: 11, bold: true, alignment: 'center', margin: [4, 4, 4, 4] },
          photoSecTitle:     { fontSize: 10, bold: true },
          photoCaption:      { fontSize: 9, color: '#4B5563' },
        },
        defaultStyle: { font: 'Roboto' },
      };

      pdfMake.createPdf(docDefinition).getBuffer((buffer) => {
        resolve(buffer);
      });
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateMasterReportPdf,
  exportMasterToPdf: generateMasterReportPdf,
};
