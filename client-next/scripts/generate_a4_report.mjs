import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jsonPath = path.resolve(__dirname, '../../reports/attendance_slots_report_2026-09-10_to_2026-10-11.json');
const htmlA4Path = path.resolve(__dirname, '../../reports/attendance_report_a4.html');
const pdfA4Path = path.resolve(__dirname, '../../reports/attendance_report_10sep_11oct_A4.pdf');
const viewerHtmlPath = path.resolve(__dirname, '../../reports/attendance_report_viewer.html');

if (!fs.existsSync(jsonPath)) {
  console.error('JSON report not found at:', jsonPath);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const { metadata, students, dates, matrix, studentStats, dailySummary } = data;

// Calculate slot totals
const slotTotals = { slot1: 0, slot2: 0, slot3: 0, slot4: 0 };
studentStats.forEach((s) => {
  slotTotals.slot1 += s.bySlot.slot1;
  slotTotals.slot2 += s.bySlot.slot2;
  slotTotals.slot3 += s.bySlot.slot3;
  slotTotals.slot4 += s.bySlot.slot4;
});

// Build the single-page A4 HTML
function buildA4Html() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Wi-Fi Attendance Report (10 Sep – 11 Oct 2026) • A4 Single Page</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 landscape;
      margin: 3.5mm 4mm 3.5mm 4mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    html, body {
      width: 100%;
      height: 100%;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #ffffff;
      color: #0f172a;
      overflow: hidden;
    }

    .page-container {
      width: 100%;
      height: 100%;
      max-height: 203mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    /* ── HEADER ── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-bottom: 3px;
      border-bottom: 1.5px solid #0f172a;
      margin-bottom: 2px;
    }
    .header-left h1 {
      font-size: 11.5pt;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #090d16;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .header-left h1 span.badge {
      background: #0284c7;
      color: #ffffff;
      font-size: 6.5pt;
      font-weight: 700;
      padding: 1.5px 5px;
      border-radius: 3px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .header-meta {
      font-size: 6.2pt;
      color: #475569;
      margin-top: 1px;
    }
    .header-meta strong {
      color: #0f172a;
    }

    .kpi-pills {
      display: flex;
      gap: 5px;
      align-items: center;
    }
    .kpi-pill {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 1.5px 6px;
      font-size: 6pt;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .kpi-pill .val {
      font-weight: 800;
      font-size: 7.2pt;
      color: #0f172a;
      font-family: 'JetBrains Mono', monospace;
    }
    .kpi-pill.highlight {
      background: #ecfdf5;
      border-color: #a7f3d0;
    }
    .kpi-pill.highlight .val {
      color: #047857;
    }

    /* ── LEGEND BAR ── */
    .legend-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 3px;
      padding: 1.5px 6px;
      font-size: 5.8pt;
      color: #334155;
      margin-bottom: 2px;
    }
    .legend-slots {
      display: flex;
      gap: 8px;
    }
    .legend-slots span strong {
      color: #0369a1;
      font-family: 'JetBrains Mono', monospace;
    }
    .legend-indicators {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 3px;
    }
    .chip-p {
      display: inline-block;
      width: 7px;
      height: 7px;
      background: #16a34a;
      border-radius: 1.5px;
    }
    .chip-a {
      display: inline-block;
      width: 7px;
      height: 7px;
      background: #e2e8f0;
      border: 0.5px solid #cbd5e1;
      border-radius: 1.5px;
    }

    /* ── MAIN TABLE ── */
    .table-wrap {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 5.6pt;
    }
    th, td {
      text-align: center;
      vertical-align: middle;
      padding: 0;
      height: 3.65mm;
      border: 0.5px solid #cbd5e1;
    }

    /* Headers */
    thead tr:first-child th {
      height: 20mm;
      vertical-align: bottom;
      background: #f8fafc;
      border-bottom: 1px solid #475569;
      padding-bottom: 2px;
    }
    thead tr:nth-child(2) th {
      height: 3mm;
      font-size: 4.8pt;
      font-weight: 700;
      background: #f1f5f9;
      color: #475569;
      border-bottom: 1.2px solid #0f172a;
      font-family: 'JetBrains Mono', monospace;
    }

    .th-corner {
      width: 13.5mm;
      background: #e2e8f0 !important;
      font-size: 5.8pt;
      font-weight: 700;
      color: #1e293b;
      vertical-align: middle !important;
      text-align: center;
      border-right: 1.2px solid #0f172a !important;
    }
    .th-tot-corner {
      width: 7.5mm;
      background: #e2e8f0 !important;
      font-size: 5.5pt;
      font-weight: 700;
      color: #1e293b;
      vertical-align: middle !important;
      text-align: center;
      border-left: 1.2px solid #0f172a !important;
    }
    .th-pct-corner {
      width: 7.5mm;
      background: #e2e8f0 !important;
      font-size: 5.5pt;
      font-weight: 700;
      color: #1e293b;
      vertical-align: middle !important;
      text-align: center;
    }

    .th-student {
      border-right: 1.2px solid #0f172a !important;
      padding: 0 1px;
      width: 9.8mm;
    }
    .v-header-wrap {
      display: inline-block;
      writing-mode: vertical-rl;
      transform: rotate(180deg);
      white-space: nowrap;
      text-align: left;
      font-size: 5.6pt;
      line-height: 1.1;
      font-weight: 600;
      color: #0f172a;
      max-height: 19mm;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .v-header-wrap .s-roll {
      color: #0284c7;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
      font-size: 5.2pt;
    }

    /* Slots sub-headers */
    .th-s {
      border-right: 0.5px solid #e2e8f0;
    }
    .th-s.slot4 {
      border-right: 1.2px solid #0f172a !important;
    }

    /* Date column */
    .td-date {
      width: 13.5mm;
      font-family: 'JetBrains Mono', monospace;
      font-size: 5.4pt;
      font-weight: 600;
      text-align: left;
      padding-left: 2px;
      color: #1e293b;
      background: #ffffff;
      border-right: 1.2px solid #0f172a !important;
      white-space: nowrap;
    }
    .td-date .day {
      color: #64748b;
      font-weight: 500;
      display: inline-block;
      width: 4.8mm;
    }

    /* Cells */
    .c-slot {
      font-family: 'JetBrains Mono', monospace;
      font-size: 5pt;
      font-weight: 800;
    }
    .c-slot.slot4 {
      border-right: 1.2px solid #0f172a !important;
    }

    .p-box {
      background: #16a34a !important;
      color: #ffffff !important;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
    }
    .a-box {
      background: transparent;
      color: #cbd5e1;
      font-size: 4.5pt;
      font-weight: 400;
    }

    /* Weekend & Holiday rows */
    tr.weekend td {
      background: #f8fafc;
    }
    tr.holiday td {
      background: #fef2f2;
    }
    tr.holiday .td-date {
      color: #b91c1c;
      font-weight: 700;
    }

    /* Totals column on right */
    .td-day-tot {
      font-family: 'JetBrains Mono', monospace;
      font-size: 5.4pt;
      font-weight: 700;
      border-left: 1.2px solid #0f172a !important;
      background: #f8fafc;
      color: #0f172a;
    }
    .td-day-tot.has-p {
      color: #15803d;
      font-weight: 800;
    }
    .td-day-pct {
      font-family: 'JetBrains Mono', monospace;
      font-size: 5pt;
      font-weight: 600;
      background: #f8fafc;
      color: #475569;
    }

    /* Summary Footer Rows */
    tfoot tr.tf-tot td {
      height: 3.5mm;
      background: #f1f5f9;
      font-family: 'JetBrains Mono', monospace;
      font-size: 5.2pt;
      font-weight: 800;
      color: #0f172a;
      border-top: 1.2px solid #0f172a;
    }
    tfoot tr.tf-pct td {
      height: 3.5mm;
      background: #e2e8f0;
      font-family: 'JetBrains Mono', monospace;
      font-size: 4.8pt;
      font-weight: 700;
      color: #0369a1;
      border-bottom: 1.5px solid #0f172a;
    }

    /* ── FOOTER BAR ── */
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 5.4pt;
      color: #64748b;
      padding-top: 2px;
      border-top: 1px solid #cbd5e1;
      margin-top: 1.5px;
    }
    .footer strong {
      color: #0f172a;
    }

    /* Screen UI Controls (hidden when printed) */
    .print-bar {
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 9999;
      display: flex;
      gap: 8px;
      background: #0f172a;
      padding: 6px 12px;
      border-radius: 8px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
    }
    .print-btn {
      background: #0284c7;
      color: #ffffff;
      border: none;
      padding: 5px 12px;
      border-radius: 4px;
      font-size: 8pt;
      font-weight: 700;
      cursor: pointer;
    }
    .print-btn:hover { background: #0369a1; }
    .viewer-btn {
      background: #334155;
      color: #ffffff;
      border: none;
      padding: 5px 10px;
      border-radius: 4px;
      font-size: 8pt;
      font-weight: 600;
      text-decoration: none;
    }

    @media print {
      .print-bar { display: none !important; }
      body { margin: 0; padding: 0; }
    }
  </style>
</head>
<body>

  <div class="print-bar">
    <button class="print-btn" onclick="window.print()">🖨️ Print / Save 1-Page A4 PDF</button>
    <a href="attendance_report_viewer.html" class="viewer-btn">🖥️ Interactive Dashboard</a>
  </div>

  <div class="page-container">

    <!-- HEADER -->
    <div class="header">
      <div class="header-left">
        <h1>
          CIPD ERP • Student Wi-Fi Interval Attendance Ledger
          <span class="badge">Official A4 Report</span>
        </h1>
        <div class="header-meta">
          Period: <strong>10 September – 11 October 2026</strong> (32 Days) &nbsp;|&nbsp;
          Cohort: <strong>July 2026 (Active)</strong> &nbsp;|&nbsp;
          Rows: <strong>32 Dates</strong> &nbsp;|&nbsp;
          Columns: <strong>26 Students × 4 Daily Slots (104 Columns)</strong>
        </div>
      </div>
      <div class="kpi-pills">
        <div class="kpi-pill">
          <span>STUDENTS</span>
          <span class="val">${metadata.totalStudents}</span>
        </div>
        <div class="kpi-pill">
          <span>EVALUATIONS</span>
          <span class="val">${metadata.totalPossibleSlots}</span>
        </div>
        <div class="kpi-pill highlight">
          <span>PRESENT MARKS</span>
          <span class="val">${metadata.totalActualPresentSlots}</span>
        </div>
        <div class="kpi-pill highlight">
          <span>OVERALL ATT%</span>
          <span class="val">${metadata.overallAttendancePct}%</span>
        </div>
      </div>
    </div>

    <!-- LEGEND -->
    <div class="legend-bar">
      <div class="legend-slots">
        <span><strong>S1:</strong> 09:30–11:00 (${slotTotals.slot1})</span>
        <span><strong>S2:</strong> 11:15–12:45 (${slotTotals.slot2})</span>
        <span><strong>S3:</strong> 14:00–15:30 (${slotTotals.slot3})</span>
        <span><strong>S4:</strong> 15:45–17:30 (${slotTotals.slot4})</span>
      </div>
      <div class="legend-indicators">
        <div class="legend-item"><span class="chip-p"></span> <strong>P</strong> = Present (≥1 MAC detection in slot)</div>
        <div class="legend-item"><span class="chip-a"></span> <strong>·</strong> = Absent (no detection)</div>
        <span style="color:#64748b;">| Backend Rule: wifi_snapshots via Supabase; Student registry via Drizzle</span>
      </div>
    </div>

    <!-- TABLE -->
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="th-corner" rowspan="2">Date &amp; Day</th>
            ${students.map((s) => {
              const shortRoll = s.enrollmentNo.replace('iPDCP2026', '').replace('CIPD/2026/', '');
              return `
                <th class="th-student" colspan="4">
                  <div class="v-header-wrap">
                    ${s.name} <span class="s-roll">[${shortRoll}]</span>
                  </div>
                </th>
              `;
            }).join('')}
            <th class="th-tot-corner" rowspan="2">Day<br>Tot</th>
            <th class="th-pct-corner" rowspan="2">Day<br>%</th>
          </tr>
          <tr>
            ${students.map(() => `
              <th class="th-s">1</th>
              <th class="th-s">2</th>
              <th class="th-s">3</th>
              <th class="th-s slot4">4</th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          ${dates.map(({ dateStr, dayName }) => {
            const isWeekend = dayName === 'Sat' || dayName === 'Sun';
            const isHoliday = dateStr === '2026-10-02';
            const rowClass = isHoliday ? 'holiday' : isWeekend ? 'weekend' : '';
            const dayCount = dailySummary[dateStr].presentCount;
            const dayPct = ((dayCount / (students.length * 4)) * 100).toFixed(0);
            const dateShort = dateStr.slice(5).replace('-', '/');

            return `
              <tr class="${rowClass}">
                <td class="td-date">
                  <span class="day">${dayName}</span> ${dateShort}
                </td>
                ${students.map((s) => {
                  const s1 = matrix[dateStr][s.id]['slot1'] === 'P';
                  const s2 = matrix[dateStr][s.id]['slot2'] === 'P';
                  const s3 = matrix[dateStr][s.id]['slot3'] === 'P';
                  const s4 = matrix[dateStr][s.id]['slot4'] === 'P';

                  return `
                    <td class="c-slot">${s1 ? '<div class="p-box">P</div>' : '<span class="a-box">·</span>'}</td>
                    <td class="c-slot">${s2 ? '<div class="p-box">P</div>' : '<span class="a-box">·</span>'}</td>
                    <td class="c-slot">${s3 ? '<div class="p-box">P</div>' : '<span class="a-box">·</span>'}</td>
                    <td class="c-slot slot4">${s4 ? '<div class="p-box">P</div>' : '<span class="a-box">·</span>'}</td>
                  `;
                }).join('')}
                <td class="td-day-tot ${dayCount > 0 ? 'has-p' : ''}">${dayCount}</td>
                <td class="td-day-pct">${dayCount > 0 ? `${dayPct}%` : '—'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
        <tfoot>
          <tr class="tf-tot">
            <td style="font-weight:800; font-size:5.4pt; text-align:left; padding-left:2px;">Slot Totals</td>
            ${students.map((s) => {
              const stats = studentStats.find((st) => st.enrollmentNo === s.enrollmentNo);
              return `
                <td class="c-slot">${stats?.bySlot.slot1 || 0}</td>
                <td class="c-slot">${stats?.bySlot.slot2 || 0}</td>
                <td class="c-slot">${stats?.bySlot.slot3 || 0}</td>
                <td class="c-slot slot4">${stats?.bySlot.slot4 || 0}</td>
              `;
            }).join('')}
            <td class="td-day-tot">${metadata.totalActualPresentSlots}</td>
            <td class="td-day-pct">TOT</td>
          </tr>
          <tr class="tf-pct">
            <td style="font-weight:800; font-size:5pt; text-align:left; padding-left:2px;">Attendance %</td>
            ${students.map((s) => {
              const stats = studentStats.find((st) => st.enrollmentNo === s.enrollmentNo);
              const pct = stats ? Math.round((stats.totalSlotsPresent / stats.totalSlotsEvaluated) * 100) : 0;
              return `
                <td class="c-slot slot4" colspan="4" style="text-align:center; font-weight:800; color:#0369a1;">
                  ${pct}% <span style="font-size:4.2pt; color:#64748b;">(${stats?.totalSlotsPresent || 0})</span>
                </td>
              `;
            }).join('')}
            <td class="td-day-tot" colspan="2" style="font-size:5.2pt; color:#047857; font-weight:800;">
              ${metadata.overallAttendancePct}%
            </td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- FOOTER -->
    <div class="footer">
      <div>
        Generated via <strong>Antigravity CIPD ERP System</strong> on ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}.
        Telemetry: <strong>${dailySummary['2026-09-14'].snapshotsCount * 25}+ Wi-Fi snapshots</strong> processed.
      </div>
      <div>
        Top Attending: <strong>#1 Hemant Bhagat (32.8%)</strong> • <strong>#2 Ujjwal Goel (31.3%)</strong> • <strong>#3 Pratik Yadav (28.1%)</strong>
      </div>
      <div>
        Page <strong>1 of 1</strong> (A4 Landscape)
      </div>
    </div>

  </div>

</body>
</html>`;
}

// Generate HTML and write
const htmlContent = buildA4Html();
fs.writeFileSync(htmlA4Path, htmlContent, 'utf8');
console.log('✅ Generated A4 HTML:', htmlA4Path);

// Render to PDF using Google Chrome headless
console.log('⏳ Rendering pixel-perfect 1-page A4 PDF using Google Chrome...');
try {
  execSync(
    `google-chrome --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="${pdfA4Path}" "${htmlA4Path}"`,
    { stdio: 'inherit' }
  );
  console.log('✅ Generated A4 PDF:', pdfA4Path);

  // Verify page count using pdfinfo
  const infoOutput = execSync(`pdfinfo "${pdfA4Path}"`).toString();
  const pagesMatch = infoOutput.match(/Pages:\s+(\d+)/);
  const totalPages = pagesMatch ? parseInt(pagesMatch[1], 10) : 'unknown';

  console.log(`\n======================================================`);
  console.log(`📄 PDF Verification via pdfinfo:`);
  console.log(`Total Pages: ${totalPages}`);
  if (totalPages === 1) {
    console.log(`🎉 SUCCESS! The report is EXACTLY 1 A4 PAGE!`);
  } else {
    console.warn(`⚠️ Warning: Expected 1 page but got ${totalPages} pages.`);
  }
  console.log(`======================================================\n`);
} catch (e) {
  console.error('Failed to generate PDF:', e.message);
}
