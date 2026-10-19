import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pre-load environment variables before importing db or supabase
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Dynamic imports to ensure process.env is populated
const { db } = await import('../lib/db.js');
const { students, users } = await import('../drizzle/schema.ts');
const { eq } = await import('drizzle-orm');
const { createClient } = await import('@supabase/supabase-js');
const { normalizeMac, isValidMac } = await import('../lib/attendance-mac.js');

// Supabase client specifically for wifi_snapshots as per migration rule
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  }
);

export const SLOTS = [
  { id: 'slot1', label: '09:30 - 11:00', shortLabel: '9:30-11am', start: '09:30:00', end: '11:00:00' },
  { id: 'slot2', label: '11:15 - 12:45', shortLabel: '11:15am-12:45pm', start: '11:15:00', end: '12:45:00' },
  { id: 'slot3', label: '14:00 - 15:30', shortLabel: '2pm-3:30pm', start: '14:00:00', end: '15:30:00' },
  { id: 'slot4', label: '15:45 - 17:30', shortLabel: '3:45pm-5:30pm', start: '15:45:00', end: '17:30:00' },
];

export async function generateWifiAttendanceReport(options = {}) {
  const {
    dateFrom = '2026-09-10',
    dateTo = '2026-10-11',
    outputDir = path.resolve(__dirname, '../../reports'),
  } = options;

  console.log(`\n======================================================`);
  console.log(`📊 GENERATING WI-FI ATTENDANCE REPORT`);
  console.log(`📅 Period: ${dateFrom} to ${dateTo}`);
  console.log(`🕒 Slots: ${SLOTS.map(s => s.label).join(' | ')}`);
  console.log(`💾 Output Directory: ${outputDir}`);
  console.log(`======================================================\n`);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 1. REST USE DRIZZLE: Fetch students and associated user info
  console.log('⏳ [Drizzle] Fetching enrolled students and user records...');
  const studentRows = await db
    .select({
      id: students.id,
      enrollmentNo: students.enrollmentNo,
      macAddress: students.macAddress,
      macVerified: students.macVerified,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      isActive: users.isActive,
    })
    .from(students)
    .leftJoin(users, eq(students.id, users.id))
    .orderBy(students.enrollmentNo);

  console.log(`✅ [Drizzle] Retrieved ${studentRows.length} students.\n`);

  const studentList = studentRows.map((s) => {
    const rawMac = s.macAddress || '';
    const norm = normalizeMac(rawMac);
    const valid = isValidMac(norm);
    const name = [s.firstName, s.lastName].filter(Boolean).join(' ') || 'Unnamed Student';

    return {
      id: s.id,
      enrollmentNo: s.enrollmentNo || 'NO-ENROLLMENT',
      name,
      email: s.email || '',
      macAddress: rawMac,
      normalizedMac: valid ? norm : null,
      macVerified: !!s.macVerified,
      isActive: s.isActive ?? true,
    };
  });

  // 2. Generate date list
  const dates = [];
  let curr = new Date(`${dateFrom}T00:00:00+05:30`);
  const end = new Date(`${dateTo}T00:00:00+05:30`);
  while (curr <= end) {
    const yyyy = curr.getFullYear();
    const mm = String(curr.getMonth() + 1).padStart(2, '0');
    const dd = String(curr.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const dayName = curr.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Kolkata' });
    dates.push({ dateStr, dayName });
    curr.setDate(curr.getDate() + 1);
  }

  console.log(`⏳ Processing ${dates.length} days (${dateFrom} to ${dateTo}) with 4 slots each (${dates.length * 4} total intervals)...`);

  // 3. USE SUPABASE FOR wifi_snapshots: Query day by day and match MACs
  const matrix = {}; // matrix[dateStr][studentId][slotId] = 'P' | 'A'
  const dailySummary = {};
  const studentStats = {};

  studentList.forEach((st) => {
    studentStats[st.id] = {
      enrollmentNo: st.enrollmentNo,
      name: st.name,
      mac: st.normalizedMac,
      macVerified: st.macVerified,
      totalSlotsPresent: 0,
      totalSlotsEvaluated: dates.length * 4,
      bySlot: { slot1: 0, slot2: 0, slot3: 0, slot4: 0 },
    };
  });

  for (let i = 0; i < dates.length; i++) {
    const { dateStr, dayName } = dates[i];
    matrix[dateStr] = {};
    dailySummary[dateStr] = {
      date: dateStr,
      dayName,
      snapshotsCount: 0,
      presentCount: 0,
      bySlotPresent: { slot1: 0, slot2: 0, slot3: 0, slot4: 0 },
    };

    // Day time window: 09:30 to 17:30 IST (+05:30)
    const dayStartIso = `${dateStr}T09:30:00+05:30`;
    const dayEndIso = `${dateStr}T17:30:00+05:30`;

    // Query wifi_snapshots using Supabase Client
    const { data: snapshots, error } = await supabase
      .schema('public')
      .from('wifi_snapshots')
      .select('id, captured_at, iw_dump')
      .gte('captured_at', dayStartIso)
      .lte('captured_at', dayEndIso)
      .order('captured_at', { ascending: true });

    if (error) {
      console.error(`❌ [Supabase] Error querying snapshots for ${dateStr}:`, error.message);
    }

    const snapCount = snapshots?.length || 0;
    dailySummary[dateStr].snapshotsCount = snapCount;

    // Collect seen MACs per slot
    const slotSeenMacs = {
      slot1: new Set(),
      slot2: new Set(),
      slot3: new Set(),
      slot4: new Set(),
    };

    (snapshots || []).forEach((snap) => {
      const snapTime = new Date(snap.captured_at).getTime();

      let matchedSlot = null;
      for (const slot of SLOTS) {
        const slotStartMs = new Date(`${dateStr}T${slot.start}+05:30`).getTime();
        const slotEndMs = new Date(`${dateStr}T${slot.end}+05:30`).getTime();
        if (snapTime >= slotStartMs && snapTime <= slotEndMs) {
          matchedSlot = slot.id;
          break;
        }
      }

      if (!matchedSlot) return;

      let clients = [];
      try {
        let dump = snap.iw_dump;
        if (typeof dump === 'string') dump = JSON.parse(dump);
        if (typeof dump === 'string') dump = JSON.parse(dump);
        clients = Array.isArray(dump) ? dump : [];
      } catch {
        clients = [];
      }

      clients.forEach((c) => {
        if (c && c.mac) {
          const norm = normalizeMac(c.mac);
          if (isValidMac(norm)) {
            slotSeenMacs[matchedSlot].add(norm);
          }
        }
      });
    });

    // Score attendance for each student in each slot
    studentList.forEach((st) => {
      matrix[dateStr][st.id] = {};

      SLOTS.forEach((slot) => {
        // "just one detection is enough"
        const isPresent = st.normalizedMac ? slotSeenMacs[slot.id].has(st.normalizedMac) : false;
        const code = isPresent ? 'P' : 'A';
        matrix[dateStr][st.id][slot.id] = code;

        if (isPresent) {
          studentStats[st.id].totalSlotsPresent++;
          studentStats[st.id].bySlot[slot.id]++;
          dailySummary[dateStr].presentCount++;
          dailySummary[dateStr].bySlotPresent[slot.id]++;
        }
      });
    });

    const progressPct = Math.round(((i + 1) / dates.length) * 100);
    process.stdout.write(`\r  → Processed [${i + 1}/${dates.length}] ${dateStr} (${dayName}) | Snaps: ${snapCount} | Present Slots: ${dailySummary[dateStr].presentCount} (${progressPct}%)`);
  }
  console.log('\n✅ All dates evaluated successfully!\n');

  // 4. Generate CSV Reports
  // -------------------------------------------------------------
  const flatHeaders = ['Date', 'Day of Week'];

  studentList.forEach((st) => {
    SLOTS.forEach((slot) => {
      flatHeaders.push(`${st.name} [${st.enrollmentNo}] - ${slot.label}`);
    });
  });

  // Flat CSV rows
  const flatCsvRows = [flatHeaders.map((h) => `"${h}"`).join(',')];
  dates.forEach(({ dateStr, dayName }) => {
    const row = [dateStr, dayName];
    studentList.forEach((st) => {
      SLOTS.forEach((slot) => {
        row.push(matrix[dateStr][st.id][slot.id]);
      });
    });
    flatCsvRows.push(row.join(','));
  });

  const flatCsvContent = flatCsvRows.join('\r\n');
  const csvPath = path.join(outputDir, `attendance_slots_report_${dateFrom}_to_${dateTo}.csv`);
  fs.writeFileSync(csvPath, flatCsvContent, 'utf-8');
  console.log(`📄 Saved CSV Report: ${csvPath}`);

  // -------------------------------------------------------------
  // 5. Generate Excel (.xlsx) with multi-level headers and sheets
  // -------------------------------------------------------------
  const wb = XLSX.utils.book_new();

  // Sheet 1: Main Grid
  const sheet1Data = [];
  
  // Row 1: Student Names (spans 4 columns each)
  const headerRow1 = ['Date', 'Day'];
  studentList.forEach((st) => {
    headerRow1.push(`${st.name} (${st.enrollmentNo})`, '', '', '');
  });
  headerRow1.push('Day Present Total', 'Day Attendance %');
  sheet1Data.push(headerRow1);

  // Row 2: Slots
  const headerRow2 = ['YYYY-MM-DD', 'Day'];
  studentList.forEach(() => {
    SLOTS.forEach((slot) => {
      headerRow2.push(slot.label);
    });
  });
  headerRow2.push('All Slots', '%');
  sheet1Data.push(headerRow2);

  // Data rows
  dates.forEach(({ dateStr, dayName }) => {
    const row = [dateStr, dayName];
    let dayP = 0;
    studentList.forEach((st) => {
      SLOTS.forEach((slot) => {
        const val = matrix[dateStr][st.id][slot.id];
        row.push(val);
        if (val === 'P') dayP++;
      });
    });
    const dayPossible = studentList.length * 4;
    const dayPct = dayPossible > 0 ? `${((dayP / dayPossible) * 100).toFixed(1)}%` : '0%';
    row.push(dayP, dayPct);
    sheet1Data.push(row);
  });

  // Summary Row: Student totals
  const summaryRowTotal = ['Total Present Slots', 'All Days'];
  const summaryRowPct = ['Attendance %', 'Overall'];
  studentList.forEach((st) => {
    const stats = studentStats[st.id];
    SLOTS.forEach((slot) => {
      summaryRowTotal.push(stats.bySlot[slot.id]);
      const slotPct = `${((stats.bySlot[slot.id] / dates.length) * 100).toFixed(1)}%`;
      summaryRowPct.push(slotPct);
    });
  });
  const grandTotalPresent = Object.values(dailySummary).reduce((acc, d) => acc + d.presentCount, 0);
  const grandTotalPossible = dates.length * 4 * studentList.length;
  summaryRowTotal.push(grandTotalPresent, '');
  summaryRowPct.push('', `${((grandTotalPresent / grandTotalPossible) * 100).toFixed(1)}%`);
  sheet1Data.push(summaryRowTotal);
  sheet1Data.push(summaryRowPct);

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);

  // Set merges for Row 1
  const merges = [
    { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, // Date
    { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } }, // Day
  ];
  let colCursor = 2;
  studentList.forEach(() => {
    merges.push({ s: { r: 0, c: colCursor }, e: { r: 0, c: colCursor + 3 } });
    colCursor += 4;
  });
  merges.push({ s: { r: 0, c: colCursor }, e: { r: 0, c: colCursor + 1 } });
  ws1['!merges'] = merges;

  // Auto-column widths
  ws1['!cols'] = [
    { wch: 12 },
    { wch: 6 },
    ...studentList.flatMap(() => [
      { wch: 13 },
      { wch: 13 },
      { wch: 13 },
      { wch: 13 },
    ]),
    { wch: 18 },
    { wch: 16 },
  ];

  XLSX.utils.book_append_sheet(wb, ws1, 'Attendance Grid');

  // Sheet 2: Student Summary Table
  const sheet2Data = [
    [
      'Enrollment No',
      'Student Name',
      'Registered MAC',
      'MAC Verified',
      'Total Slots Present',
      'Total Possible Slots',
      'Overall Attendance %',
      'Slot 1 (09:30-11:00)',
      'Slot 2 (11:15-12:45)',
      'Slot 3 (14:00-15:30)',
      'Slot 4 (15:45-17:30)',
    ],
  ];

  const sortedStudentStats = Object.values(studentStats).sort(
    (a, b) => b.totalSlotsPresent - a.totalSlotsPresent
  );

  sortedStudentStats.forEach((st) => {
    const pct = ((st.totalSlotsPresent / st.totalSlotsEvaluated) * 100).toFixed(1);
    sheet2Data.push([
      st.enrollmentNo,
      st.name,
      st.mac || 'N/A',
      st.macVerified ? 'Yes' : 'No',
      st.totalSlotsPresent,
      st.totalSlotsEvaluated,
      `${pct}%`,
      st.bySlot.slot1,
      st.bySlot.slot2,
      st.bySlot.slot3,
      st.bySlot.slot4,
    ]);
  });

  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
  ws2['!cols'] = [
    { wch: 16 },
    { wch: 25 },
    { wch: 20 },
    { wch: 12 },
    { wch: 18 },
    { wch: 18 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, ws2, 'Student Leaderboard');

  // Sheet 3: Daily Trend
  const sheet3Data = [
    [
      'Date',
      'Day',
      'Wi-Fi Snapshots',
      'Total Present Slots',
      'Possible Slots',
      'Day Attendance %',
      'Slot 1 Present',
      'Slot 2 Present',
      'Slot 3 Present',
      'Slot 4 Present',
    ],
  ];

  dates.forEach(({ dateStr, dayName }) => {
    const d = dailySummary[dateStr];
    const possible = studentList.length * 4;
    const pct = possible > 0 ? `${((d.presentCount / possible) * 100).toFixed(1)}%` : '0%';
    sheet3Data.push([
      dateStr,
      dayName,
      d.snapshotsCount,
      d.presentCount,
      possible,
      pct,
      d.bySlotPresent.slot1,
      d.bySlotPresent.slot2,
      d.bySlotPresent.slot3,
      d.bySlotPresent.slot4,
    ]);
  });

  const ws3 = XLSX.utils.aoa_to_sheet(sheet3Data);
  ws3['!cols'] = [
    { wch: 14 },
    { wch: 8 },
    { wch: 16 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, ws3, 'Daily Attendance Trend');

  const excelPath = path.join(outputDir, `attendance_slots_report_${dateFrom}_to_${dateTo}.xlsx`);
  XLSX.writeFile(wb, excelPath);
  console.log(`📊 Saved Excel Workbook: ${excelPath}`);

  // -------------------------------------------------------------
  // 6. Save JSON Data File
  // -------------------------------------------------------------
  const reportPayload = {
    metadata: {
      generatedAt: new Date().toISOString(),
      dateFrom,
      dateTo,
      totalDays: dates.length,
      totalStudents: studentList.length,
      totalSlotsPerDay: SLOTS.length,
      totalPossibleSlots: grandTotalPossible,
      totalActualPresentSlots: grandTotalPresent,
      overallAttendancePct: Number(((grandTotalPresent / grandTotalPossible) * 100).toFixed(2)),
      slots: SLOTS,
    },
    students: studentList,
    dates,
    matrix,
    dailySummary,
    studentStats: sortedStudentStats,
  };

  const jsonPath = path.join(outputDir, `attendance_slots_report_${dateFrom}_to_${dateTo}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(reportPayload, null, 2), 'utf-8');
  console.log(`💾 Saved JSON Report: ${jsonPath}`);

  // -------------------------------------------------------------
  // 7. Generate Standalone HTML Interactive Report Viewer
  // -------------------------------------------------------------
  const htmlContent = generateHtmlViewer(reportPayload);
  const htmlPath = path.join(outputDir, `attendance_report_viewer.html`);
  fs.writeFileSync(htmlPath, htmlContent, 'utf-8');
  console.log(`🌐 Saved Interactive HTML Viewer: ${htmlPath}`);

  console.log(`\n======================================================`);
  console.log(`🎉 REPORT GENERATION COMPLETE!`);
  console.log(`Total Present Slot Marks: ${grandTotalPresent} / ${grandTotalPossible} (${reportPayload.metadata.overallAttendancePct}%)`);
  console.log(`======================================================\n`);

  return {
    csvPath,
    excelPath,
    jsonPath,
    htmlPath,
    reportPayload,
  };
}

function generateHtmlViewer(payload) {
  const { metadata, students, dates, matrix, studentStats, dailySummary } = payload;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wi-Fi Attendance Slot Report (${metadata.dateFrom} to ${metadata.dateTo})</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #131b2e;
      --border: #23314f;
      --accent: #38bdf8;
      --present-bg: #052e16;
      --present-text: #4ade80;
      --present-border: #166534;
      --absent-bg: #1e293b;
      --absent-text: #64748b;
      --absent-border: #334155;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 24px;
    }

    .header {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 28px 32px;
      margin-bottom: 24px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .header h1 {
      font-size: 1.85rem;
      font-weight: 800;
      color: #fff;
    }
    .header .subtitle {
      color: var(--text-muted);
      margin-top: 6px;
      font-size: 0.95rem;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px 20px;
    }
    .stat-label {
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      font-weight: 600;
    }
    .stat-value {
      font-size: 1.8rem;
      font-weight: 700;
      color: #fff;
      margin-top: 4px;
    }
    .stat-sub {
      font-size: 0.8rem;
      color: var(--accent);
      margin-top: 4px;
    }

    .table-container {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 14px;
      overflow-x: auto;
      max-height: 75vh;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    }
    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-size: 0.82rem;
    }
    th, td {
      padding: 8px 10px;
      text-align: center;
      border-right: 1px solid rgba(255, 255, 255, 0.05);
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      white-space: nowrap;
    }
    thead th {
      position: sticky;
      top: 0;
      background: #0f172a;
      z-index: 10;
      font-weight: 600;
      color: #cbd5e1;
    }
    thead tr:nth-child(2) th {
      top: 47px;
      font-size: 0.72rem;
      background: #1e293b;
      color: #94a3b8;
    }
    .date-col {
      position: sticky;
      left: 0;
      background: #0f172a !important;
      z-index: 20;
      text-align: left;
      font-weight: 600;
      font-family: 'JetBrains Mono', monospace;
      padding-left: 16px;
      border-right: 2px solid var(--border) !important;
    }
    tbody tr:hover td {
      background-color: rgba(56, 189, 248, 0.04);
    }

    .badge-p {
      display: inline-block;
      width: 24px;
      height: 24px;
      line-height: 24px;
      text-align: center;
      background: var(--present-bg);
      color: var(--present-text);
      border: 1px solid var(--present-border);
      border-radius: 6px;
      font-weight: 700;
      font-size: 0.75rem;
    }
    .badge-a {
      display: inline-block;
      width: 24px;
      height: 24px;
      line-height: 24px;
      text-align: center;
      background: var(--absent-bg);
      color: var(--absent-text);
      border: 1px solid var(--absent-border);
      border-radius: 6px;
      font-size: 0.75rem;
    }

    .student-header {
      border-right: 2px solid var(--border) !important;
      text-align: center;
      padding: 10px 14px;
      font-size: 0.85rem;
    }
    .student-header .s-name { font-weight: 700; color: #fff; }
    .student-header .s-enroll { font-size: 0.72rem; color: var(--accent); font-family: 'JetBrains Mono', monospace; }

    .leaderboard-section {
      margin-top: 36px;
    }
    .section-title {
      font-size: 1.25rem;
      font-weight: 700;
      margin-bottom: 16px;
    }
    .ranking-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 14px;
    }
    .student-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 14px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .s-info-name { font-weight: 600; font-size: 0.95rem; }
    .s-info-sub { font-size: 0.78rem; color: var(--text-muted); font-family: 'JetBrains Mono', monospace; }
    .s-badge {
      padding: 6px 12px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.85rem;
      text-align: right;
    }
  </style>
</head>
<body>

  <div class="header">
    <h1>📡 Wi-Fi Attendance Interval Report</h1>
    <div class="subtitle">
      Analysis period: <strong>${metadata.dateFrom}</strong> to <strong>${metadata.dateTo}</strong> (${metadata.totalDays} days) • 4 Time Slots per Day • Multi-Interval Router Snapshot Telemetry
    </div>
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-label">Total Days</div>
      <div class="stat-value">${metadata.totalDays}</div>
      <div class="stat-sub">10 Sep – 11 Oct 2026</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Students Tracked</div>
      <div class="stat-value">${metadata.totalStudents}</div>
      <div class="stat-sub">${studentStats.filter(s => s.mac).length} with registered MAC</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Slot Evaluations</div>
      <div class="stat-value">${metadata.totalPossibleSlots.toLocaleString()}</div>
      <div class="stat-sub">32 days × 4 slots × ${metadata.totalStudents} students</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Present Marks</div>
      <div class="stat-value" style="color: #4ade80;">${metadata.totalActualPresentSlots}</div>
      <div class="stat-sub">Overall Attendance: ${metadata.overallAttendancePct}%</div>
    </div>
  </div>

  <div class="table-container">
    <table id="attendanceTable">
      <thead>
        <tr>
          <th class="date-col" rowspan="2">Date (IST)</th>
          <th rowspan="2">Day</th>
          ${students.map(s => `
            <th class="student-header" colspan="4">
              <div class="s-name">${s.name}</div>
              <div class="s-enroll">${s.enrollmentNo}</div>
            </th>
          `).join('')}
          <th rowspan="2" style="background:#1e293b; color:#fff;">Day Total Present</th>
        </tr>
        <tr>
          ${students.map(() => `
            <th>9:30-11:00</th>
            <th>11:15-12:45</th>
            <th>14:00-15:30</th>
            <th style="border-right: 2px solid var(--border);">15:45-17:30</th>
          `).join('')}
        </tr>
      </thead>
      <tbody>
        ${dates.map(({ dateStr, dayName }) => `
          <tr>
            <td class="date-col">${dateStr}</td>
            <td style="color: var(--text-muted);">${dayName}</td>
            ${students.map(s => `
              <td><span class="${matrix[dateStr][s.id]['slot1'] === 'P' ? 'badge-p' : 'badge-a'}">${matrix[dateStr][s.id]['slot1']}</span></td>
              <td><span class="${matrix[dateStr][s.id]['slot2'] === 'P' ? 'badge-p' : 'badge-a'}">${matrix[dateStr][s.id]['slot2']}</span></td>
              <td><span class="${matrix[dateStr][s.id]['slot3'] === 'P' ? 'badge-p' : 'badge-a'}">${matrix[dateStr][s.id]['slot3']}</span></td>
              <td style="border-right: 2px solid var(--border);"><span class="${matrix[dateStr][s.id]['slot4'] === 'P' ? 'badge-p' : 'badge-a'}">${matrix[dateStr][s.id]['slot4']}</span></td>
            `).join('')}
            <td style="font-weight: 700; color: ${dailySummary[dateStr].presentCount > 0 ? '#4ade80' : '#64748b'};">
              ${dailySummary[dateStr].presentCount}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="leaderboard-section">
    <div class="section-title">🏆 Student Attendance Summary</div>
    <div class="ranking-grid">
      ${studentStats.map((st, idx) => {
        const pct = ((st.totalSlotsPresent / st.totalSlotsEvaluated) * 100).toFixed(1);
        const color = pct >= 25 ? '#4ade80' : pct > 0 ? '#38bdf8' : '#64748b';
        return `
          <div class="student-card">
            <div>
              <div class="s-info-name">#${idx + 1} ${st.name}</div>
              <div class="s-info-sub">${st.enrollmentNo} • MAC: ${st.mac || 'None'}</div>
              <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 4px;">
                S1: ${st.bySlot.slot1} | S2: ${st.bySlot.slot2} | S3: ${st.bySlot.slot3} | S4: ${st.bySlot.slot4}
              </div>
            </div>
            <div class="s-badge" style="background: rgba(255,255,255,0.05); color: ${color};">
              <div style="font-size: 1.15rem;">${st.totalSlotsPresent} / 128</div>
              <div style="font-size: 0.75rem;">${pct}%</div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  </div>

</body>
</html>`;
}

// Execute if run directly from CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateWifiAttendanceReport()
    .then(() => {
      console.log('✅ Done!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Execution error:', err);
      process.exit(1);
    });
}
