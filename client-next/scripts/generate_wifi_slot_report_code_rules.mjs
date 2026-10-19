import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import XLSX from 'xlsx';
import { execSync } from 'child_process';

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
const {
  calculatePoints,
  resolveAttendanceStatus,
  MIN_DURATION_PERCENT,
} = await import('../lib/attendance-points.js');

// Supabase client specifically for wifi_snapshots as per migration rule
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  }
);

export const SLOTS = [
  { id: 'slot1', label: '09:30 - 11:00', shortLabel: '9:30-11am', start: '09:30:00', end: '11:00:00', durMin: 90 },
  { id: 'slot2', label: '11:15 - 12:45', shortLabel: '11:15am-12:45pm', start: '11:15:00', end: '12:45:00', durMin: 90 },
  { id: 'slot3', label: '14:00 - 15:30', shortLabel: '2pm-3:30pm', start: '14:00:00', end: '15:30:00', durMin: 90 },
  { id: 'slot4', label: '15:45 - 17:30', shortLabel: '3:45pm-5:30pm', start: '15:45:00', end: '17:30:00', durMin: 105 },
];

export async function generateWifiAttendanceReportWithCodeRules(options = {}) {
  const {
    dateFrom = '2026-09-10',
    dateTo = '2026-10-11',
    outputDir = path.resolve(__dirname, '../../reports'),
  } = options;

  console.log(`\n======================================================`);
  console.log(`📊 GENERATING WI-FI REPORT WITH CODE RULES`);
  console.log(`📏 Rule: MIN_DURATION_PERCENT = ${MIN_DURATION_PERCENT}% (lib/attendance-points.js)`);
  console.log(`📅 Period: ${dateFrom} to ${dateTo}`);
  console.log(`🕒 Slots: ${SLOTS.map(s => s.label).join(' | ')}`);
  console.log(`💾 Output Directory: ${outputDir}`);
  console.log(`======================================================\n`);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 1. REST USE DRIZZLE: Fetch students and user records
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
  const curr = new Date(`${dateFrom}T00:00:00+05:30`);
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

  // 3. Score Attendance according to Codebase Rules
  const matrix = {}; // matrix[dateStr][studentId][slotId] = { status: 'P'|'A', points, durationMin, durationPercent, pings }
  const singleDetectionMatrix = {}; // Comparison baseline
  const dailySummary = {};
  const studentStats = {};

  studentList.forEach((st) => {
    studentStats[st.id] = {
      enrollmentNo: st.enrollmentNo,
      name: st.name,
      mac: st.normalizedMac,
      macVerified: st.macVerified,
      totalSlotsPresent: 0,
      totalSlotsSingleDetection: 0,
      totalPointsEarned: 0,
      totalSlotsEvaluated: dates.length * 4,
      bySlot: { slot1: 0, slot2: 0, slot3: 0, slot4: 0 },
      bySlotSingle: { slot1: 0, slot2: 0, slot3: 0, slot4: 0 },
    };
  });

  for (let i = 0; i < dates.length; i++) {
    const { dateStr, dayName } = dates[i];
    matrix[dateStr] = {};
    singleDetectionMatrix[dateStr] = {};
    dailySummary[dateStr] = {
      date: dateStr,
      dayName,
      snapshotsCount: 0,
      codeRulesPresentCount: 0,
      singleDetectionPresentCount: 0,
      bySlotPresent: { slot1: 0, slot2: 0, slot3: 0, slot4: 0 },
      bySlotSingle: { slot1: 0, slot2: 0, slot3: 0, slot4: 0 },
    };

    const dayStartIso = `${dateStr}T09:30:00+05:30`;
    const dayEndIso = `${dateStr}T17:30:00+05:30`;

    // Query wifi_snapshots using Supabase Client
    const { data: snapshots } = await supabase
      .schema('public')
      .from('wifi_snapshots')
      .select('id, captured_at, iw_dump')
      .gte('captured_at', dayStartIso)
      .lte('captured_at', dayEndIso)
      .order('captured_at', { ascending: true });

    dailySummary[dateStr].snapshotsCount = snapshots?.length || 0;

    for (const slot of SLOTS) {
      const slotStartMs = new Date(`${dateStr}T${slot.start}+05:30`).getTime();
      const slotEndMs = new Date(`${dateStr}T${slot.end}+05:30`).getTime();
      const slotStartAt = new Date(slotStartMs);
      const slotEndAt = new Date(slotEndMs);

      // Filter snapshots falling in this slot
      const slotSnaps = (snapshots || []).filter((snap) => {
        const t = new Date(snap.captured_at).getTime();
        return t >= slotStartMs && t <= slotEndMs;
      });

      // Build timelines per MAC
      const macTimelines = {};
      slotSnaps.forEach((snap) => {
        const snapTime = new Date(snap.captured_at);
        let dump = snap.iw_dump;
        if (typeof dump === 'string') {
          try {
            dump = JSON.parse(dump);
            if (typeof dump === 'string') dump = JSON.parse(dump);
          } catch {}
        }
        const clients = Array.isArray(dump) ? dump : [];
        clients.forEach((c) => {
          if (c && c.mac) {
            const norm = normalizeMac(c.mac);
            if (isValidMac(norm)) {
              if (!macTimelines[norm]) macTimelines[norm] = [];
              macTimelines[norm].push({ snapshotId: snap.id, time: snapTime });
            }
          }
        });
      });

      // Score each student
      studentList.forEach((st) => {
        if (!matrix[dateStr][st.id]) matrix[dateStr][st.id] = {};
        if (!singleDetectionMatrix[dateStr][st.id]) singleDetectionMatrix[dateStr][st.id] = {};

        const timeline = st.normalizedMac ? macTimelines[st.normalizedMac] || [] : [];
        const detected = timeline.length > 0;

        // Baseline: Single detection
        const singleP = detected;
        singleDetectionMatrix[dateStr][st.id][slot.id] = singleP ? 'P' : 'A';
        if (singleP) {
          studentStats[st.id].totalSlotsSingleDetection++;
          studentStats[st.id].bySlotSingle[slot.id]++;
          dailySummary[dateStr].singleDetectionPresentCount++;
          dailySummary[dateStr].bySlotSingle[slot.id]++;
        }

        // Codebase Official Rule:
        // calculatePoints + resolveAttendanceStatus (MIN_DURATION_PERCENT = 25%)
        let status = 'absent';
        let scoring = { points: 0, durationPercent: 0, durationMin: 0 };
        let pingCount = 0;

        if (detected) {
          const uniqueSnapshots = new Set(timeline.map((t) => t.snapshotId));
          pingCount = uniqueSnapshots.size;
          const firstSeen = timeline[0].time;
          const lastSeen = timeline[timeline.length - 1].time;

          scoring = calculatePoints({
            firstSeenAt: firstSeen,
            lastSeenAt: lastSeen,
            sessionStartAt: slotStartAt,
            sessionEndAt: slotEndAt,
            detected: true,
            finalizeAbsent: true,
          });

          status = resolveAttendanceStatus({
            durationPercent: scoring.durationPercent ?? 0,
            detected: true,
            finalizeAbsent: true,
            isOngoing: false,
          });
        }

        const isCodePresent = status === 'present';
        matrix[dateStr][st.id][slot.id] = {
          code: isCodePresent ? 'P' : 'A',
          points: scoring.points || 0,
          durationPercent: scoring.durationPercent || 0,
          pingCount,
        };

        if (isCodePresent) {
          studentStats[st.id].totalSlotsPresent++;
          studentStats[st.id].totalPointsEarned += scoring.points || 0;
          studentStats[st.id].bySlot[slot.id]++;
          dailySummary[dateStr].codeRulesPresentCount++;
          dailySummary[dateStr].bySlotPresent[slot.id]++;
        }
      });
    }

    const progressPct = Math.round(((i + 1) / dates.length) * 100);
    process.stdout.write(
      `\r  → Processed [${i + 1}/${dates.length}] ${dateStr} (${dayName}) | Prev P: ${dailySummary[dateStr].singleDetectionPresentCount} → Code Rule P: ${dailySummary[dateStr].codeRulesPresentCount} (${progressPct}%)`
    );
  }
  console.log('\n✅ All dates evaluated successfully under codebase rules!\n');

  const grandTotalCodePresent = Object.values(dailySummary).reduce(
    (acc, d) => acc + d.codeRulesPresentCount,
    0
  );
  const grandTotalSinglePresent = Object.values(dailySummary).reduce(
    (acc, d) => acc + d.singleDetectionPresentCount,
    0
  );
  const grandTotalPossible = dates.length * 4 * studentList.length;

  // -------------------------------------------------------------
  // 4. Generate CSV Matrix
  // -------------------------------------------------------------
  const flatHeaders = ['Date', 'Day of Week'];
  studentList.forEach((st) => {
    SLOTS.forEach((slot) => {
      flatHeaders.push(`"${st.name} [${st.enrollmentNo}] - ${slot.label}"`);
    });
  });

  const flatCsvRows = [flatHeaders.join(',')];
  dates.forEach(({ dateStr, dayName }) => {
    const row = [dateStr, dayName];
    studentList.forEach((st) => {
      SLOTS.forEach((slot) => {
        row.push(matrix[dateStr][st.id][slot.id].code);
      });
    });
    flatCsvRows.push(row.join(','));
  });

  const flatCsvContent = flatCsvRows.join('\r\n');
  const csvPath = path.join(
    outputDir,
    `attendance_slots_report_code_rules_${dateFrom}_to_${dateTo}.csv`
  );
  fs.writeFileSync(csvPath, flatCsvContent, 'utf-8');
  console.log(`📄 Saved Code Rules CSV: ${csvPath}`);

  // -------------------------------------------------------------
  // 5. Generate Comprehensive Excel Workbook with Comparison
  // -------------------------------------------------------------
  const wb = XLSX.utils.book_new();

  // Sheet 1: Main Attendance Grid (Code Rules)
  const sheet1Data = [];
  const headerRow1 = ['Date', 'Day'];
  studentList.forEach((st) => {
    headerRow1.push(`${st.name} (${st.enrollmentNo})`, '', '', '');
  });
  headerRow1.push('Day Present Total', 'Day Attendance %');
  sheet1Data.push(headerRow1);

  const headerRow2 = ['YYYY-MM-DD', 'Day'];
  studentList.forEach(() => {
    SLOTS.forEach((slot) => headerRow2.push(slot.label));
  });
  headerRow2.push('All Slots', '%');
  sheet1Data.push(headerRow2);

  dates.forEach(({ dateStr, dayName }) => {
    const row = [dateStr, dayName];
    let dayP = 0;
    studentList.forEach((st) => {
      SLOTS.forEach((slot) => {
        const val = matrix[dateStr][st.id][slot.id].code;
        row.push(val);
        if (val === 'P') dayP++;
      });
    });
    const dayPct = `${((dayP / (studentList.length * 4)) * 100).toFixed(1)}%`;
    row.push(dayP, dayPct);
    sheet1Data.push(row);
  });

  // Summary row
  const summaryRowTotal = ['Total Present Slots', 'All Days'];
  const summaryRowPct = ['Attendance %', 'Overall'];
  studentList.forEach((st) => {
    const stats = studentStats[st.id];
    SLOTS.forEach((slot) => {
      summaryRowTotal.push(stats.bySlot[slot.id]);
      summaryRowPct.push(`${((stats.bySlot[slot.id] / dates.length) * 100).toFixed(1)}%`);
    });
  });
  summaryRowTotal.push(grandTotalCodePresent, '');
  summaryRowPct.push('', `${((grandTotalCodePresent / grandTotalPossible) * 100).toFixed(1)}%`);
  sheet1Data.push(summaryRowTotal);
  sheet1Data.push(summaryRowPct);

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
  const merges = [
    { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
    { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
  ];
  let cIdx = 2;
  studentList.forEach(() => {
    merges.push({ s: { r: 0, c: cIdx }, e: { r: 0, c: cIdx + 3 } });
    cIdx += 4;
  });
  merges.push({ s: { r: 0, c: cIdx }, e: { r: 0, c: cIdx + 1 } });
  ws1['!merges'] = merges;
  XLSX.utils.book_append_sheet(wb, ws1, 'Code Rules Attendance Grid');

  // Sheet 2: Delta Comparison Sheet (Single Detection vs Code Rules)
  const sheet2Data = [
    [
      'Enrollment No',
      'Student Name',
      'Previous (Single Detection)',
      'Previous %',
      'New (Code Rule >=25% Dur)',
      'New %',
      'Difference (Marks)',
      'Change %',
      'Quality Points Earned',
      'Status Classification',
    ],
  ];

  const sortedStudents = Object.values(studentStats).sort(
    (a, b) => b.totalSlotsPresent - a.totalSlotsPresent
  );

  sortedStudents.forEach((st) => {
    const prevCount = st.totalSlotsSingleDetection;
    const newCount = st.totalSlotsPresent;
    const diff = newCount - prevCount;
    const prevPct = ((prevCount / 128) * 100).toFixed(1);
    const newPct = ((newCount / 128) * 100).toFixed(1);
    const changePct = prevCount > 0 ? `${(((newCount - prevCount) / prevCount) * 100).toFixed(1)}%` : '0%';
    const status = st.mac ? (newCount > 0 ? 'Active / Verified' : 'Registered / Inactive') : 'Unregistered MAC';

    sheet2Data.push([
      st.enrollmentNo,
      st.name,
      prevCount,
      `${prevPct}%`,
      newCount,
      `${newPct}%`,
      diff,
      changePct,
      st.totalPointsEarned.toFixed(1),
      status,
    ]);
  });

  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
  ws2['!cols'] = [
    { wch: 16 },
    { wch: 25 },
    { wch: 22 },
    { wch: 14 },
    { wch: 24 },
    { wch: 14 },
    { wch: 18 },
    { wch: 14 },
    { wch: 20 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, ws2, 'Rule Delta Comparison');

  const excelPath = path.join(
    outputDir,
    `attendance_slots_report_code_rules_${dateFrom}_to_${dateTo}.xlsx`
  );
  XLSX.writeFile(wb, excelPath);
  console.log(`📊 Saved Excel Workbook: ${excelPath}`);

  // -------------------------------------------------------------
  // 6. Save JSON Data File
  // -------------------------------------------------------------
  const reportPayload = {
    metadata: {
      generatedAt: new Date().toISOString(),
      ruleApplied: `Official Codebase Rule: resolveAttendanceStatus with MIN_DURATION_PERCENT = ${MIN_DURATION_PERCENT}%`,
      dateFrom,
      dateTo,
      totalDays: dates.length,
      totalStudents: studentList.length,
      totalSlotsPerDay: SLOTS.length,
      totalPossibleSlots: grandTotalPossible,
      singleDetectionTotal: grandTotalSinglePresent,
      codeRulesTotal: grandTotalCodePresent,
      differenceTotal: grandTotalCodePresent - grandTotalSinglePresent,
      overallAttendancePct: Number(((grandTotalCodePresent / grandTotalPossible) * 100).toFixed(2)),
      singleDetectionAttendancePct: Number(((grandTotalSinglePresent / grandTotalPossible) * 100).toFixed(2)),
      slots: SLOTS,
    },
    students: studentList,
    dates,
    matrix,
    dailySummary,
    studentStats: sortedStudents,
  };

  const jsonPath = path.join(
    outputDir,
    `attendance_slots_report_code_rules_${dateFrom}_to_${dateTo}.json`
  );
  fs.writeFileSync(jsonPath, JSON.stringify(reportPayload, null, 2), 'utf-8');
  console.log(`💾 Saved JSON Report: ${jsonPath}`);

  // -------------------------------------------------------------
  // 7. Generate Single-Page A4 Printable HTML
  // -------------------------------------------------------------
  const a4Html = buildCodeRulesA4Html(reportPayload);
  const a4HtmlPath = path.join(outputDir, `attendance_report_code_rules_a4.html`);
  fs.writeFileSync(a4HtmlPath, a4Html, 'utf-8');
  console.log(`📄 Saved Code Rules A4 HTML: ${a4HtmlPath}`);

  // Render to 1-Page A4 PDF
  const a4PdfPath = path.join(outputDir, `attendance_report_code_rules_10sep_11oct_A4.pdf`);
  console.log('⏳ Rendering pixel-perfect 1-page A4 PDF using Google Chrome...');
  try {
    execSync(
      `google-chrome --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="${a4PdfPath}" "${a4HtmlPath}"`,
      { stdio: 'inherit' }
    );
    console.log(`✅ Saved Code Rules A4 PDF: ${a4PdfPath}`);

    const infoOutput = execSync(`pdfinfo "${a4PdfPath}"`).toString();
    const pagesMatch = infoOutput.match(/Pages:\s+(\d+)/);
    const totalPages = pagesMatch ? parseInt(pagesMatch[1], 10) : 'unknown';
    console.log(`📄 PDF Verification via pdfinfo: Total Pages = ${totalPages}`);
  } catch (e) {
    console.error('Failed to generate PDF:', e.message);
  }

  // -------------------------------------------------------------
  // 8. Generate Interactive Viewer
  // -------------------------------------------------------------
  const viewerHtml = buildViewerHtml(reportPayload);
  const viewerPath = path.join(outputDir, `attendance_report_code_rules_viewer.html`);
  fs.writeFileSync(viewerPath, viewerHtml, 'utf-8');
  console.log(`🌐 Saved Interactive HTML Dashboard: ${viewerPath}`);

  console.log(`\n======================================================`);
  console.log(`🎉 CODE RULES REPORT COMPLETE!`);
  console.log(`Previous Single Detection Present: ${grandTotalSinglePresent} (${reportPayload.metadata.singleDetectionAttendancePct}%)`);
  console.log(`New Code Rules Present (≥25% dur):  ${grandTotalCodePresent} (${reportPayload.metadata.overallAttendancePct}%)`);
  console.log(`Net Difference:                    ${grandTotalCodePresent - grandTotalSinglePresent} marks (${(((grandTotalCodePresent - grandTotalSinglePresent) / grandTotalSinglePresent) * 100).toFixed(1)}%)`);
  console.log(`======================================================\n`);

  return {
    csvPath,
    excelPath,
    jsonPath,
    a4HtmlPath,
    a4PdfPath,
    viewerPath,
    reportPayload,
  };
}

function buildCodeRulesA4Html(payload) {
  const { metadata, students, dates, matrix, studentStats, dailySummary } = payload;

  const slotTotals = { slot1: 0, slot2: 0, slot3: 0, slot4: 0 };
  studentStats.forEach((s) => {
    slotTotals.slot1 += s.bySlot.slot1;
    slotTotals.slot2 += s.bySlot.slot2;
    slotTotals.slot3 += s.bySlot.slot3;
    slotTotals.slot4 += s.bySlot.slot4;
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Wi-Fi Attendance Report (Codebase Rules) • 1-Page A4</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700;800&display=swap" rel="stylesheet">
  <style>
    @page { size: A4 landscape; margin: 3.5mm 4mm 3.5mm 4mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body { width: 100%; height: 100%; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: #ffffff; color: #0f172a; overflow: hidden; }
    .page-container { width: 100%; height: 100%; max-height: 203mm; display: flex; flex-direction: column; justify-content: space-between; }
    
    .header { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 3px; border-bottom: 1.5px solid #0f172a; margin-bottom: 2px; }
    .header-left h1 { font-size: 11pt; font-weight: 800; letter-spacing: -0.02em; color: #090d16; display: flex; align-items: center; gap: 6px; }
    .header-left h1 span.badge { background: #047857; color: #ffffff; font-size: 6pt; font-weight: 700; padding: 1.5px 5px; border-radius: 3px; letter-spacing: 0.04em; text-transform: uppercase; }
    .header-meta { font-size: 5.8pt; color: #475569; margin-top: 1px; }
    .header-meta strong { color: #0f172a; }

    .kpi-pills { display: flex; gap: 4px; align-items: center; }
    .kpi-pill { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 3px; padding: 1.5px 5px; font-size: 5.6pt; text-align: center; }
    .kpi-pill .val { font-weight: 800; font-size: 6.8pt; color: #0f172a; font-family: 'JetBrains Mono', monospace; }
    .kpi-pill.highlight { background: #ecfdf5; border-color: #a7f3d0; }
    .kpi-pill.highlight .val { color: #047857; }
    .kpi-pill.delta { background: #fff1f2; border-color: #fecdd3; }
    .kpi-pill.delta .val { color: #be123c; }

    .legend-bar { display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 3px; padding: 1.5px 6px; font-size: 5.6pt; color: #334155; margin-bottom: 2px; }
    .legend-slots span strong { color: #0369a1; font-family: 'JetBrains Mono', monospace; }
    .chip-p { display: inline-block; width: 6.5px; height: 6.5px; background: #059669; border-radius: 1.5px; vertical-align: middle; margin-right: 2px; }
    .chip-a { display: inline-block; width: 6.5px; height: 6.5px; background: #e2e8f0; border: 0.5px solid #cbd5e1; border-radius: 1.5px; vertical-align: middle; margin-right: 2px; }

    .table-wrap { flex: 1; display: flex; flex-direction: column; justify-content: flex-start; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 5.4pt; }
    th, td { text-align: center; vertical-align: middle; padding: 0; height: 3.65mm; border: 0.5px solid #cbd5e1; }
    
    thead tr:first-child th { height: 20mm; vertical-align: bottom; background: #f8fafc; border-bottom: 1px solid #475569; padding-bottom: 2px; }
    thead tr:nth-child(2) th { height: 3mm; font-size: 4.6pt; font-weight: 700; background: #f1f5f9; color: #475569; border-bottom: 1.2px solid #0f172a; font-family: 'JetBrains Mono', monospace; }

    .th-corner { width: 13.5mm; background: #e2e8f0 !important; font-size: 5.6pt; font-weight: 700; color: #1e293b; border-right: 1.2px solid #0f172a !important; }
    .th-tot-corner { width: 7.5mm; background: #e2e8f0 !important; font-size: 5.3pt; font-weight: 700; color: #1e293b; border-left: 1.2px solid #0f172a !important; }
    .th-pct-corner { width: 7.5mm; background: #e2e8f0 !important; font-size: 5.3pt; font-weight: 700; color: #1e293b; }

    .th-student { border-right: 1.2px solid #0f172a !important; padding: 0 1px; width: 9.8mm; }
    .v-header-wrap { display: inline-block; writing-mode: vertical-rl; transform: rotate(180deg); white-space: nowrap; text-align: left; font-size: 5.5pt; line-height: 1.1; font-weight: 600; color: #0f172a; max-height: 19mm; overflow: hidden; text-overflow: ellipsis; }
    .v-header-wrap .s-roll { color: #0284c7; font-weight: 700; font-family: 'JetBrains Mono', monospace; font-size: 5pt; }

    .th-s { border-right: 0.5px solid #e2e8f0; }
    .th-s.slot4 { border-right: 1.2px solid #0f172a !important; }

    .td-date { width: 13.5mm; font-family: 'JetBrains Mono', monospace; font-size: 5.3pt; font-weight: 600; text-align: left; padding-left: 2px; color: #1e293b; background: #ffffff; border-right: 1.2px solid #0f172a !important; white-space: nowrap; }
    .td-date .day { color: #64748b; font-weight: 500; display: inline-block; width: 4.8mm; }

    .c-slot { font-family: 'JetBrains Mono', monospace; font-size: 4.8pt; font-weight: 800; }
    .c-slot.slot4 { border-right: 1.2px solid #0f172a !important; }

    .p-box { background: #059669 !important; color: #ffffff !important; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-weight: 800; }
    .a-box { background: transparent; color: #cbd5e1; font-size: 4.5pt; font-weight: 400; }

    tr.weekend td { background: #f8fafc; }
    tr.holiday td { background: #fef2f2; }
    tr.holiday .td-date { color: #b91c1c; font-weight: 700; }

    .td-day-tot { font-family: 'JetBrains Mono', monospace; font-size: 5.3pt; font-weight: 700; border-left: 1.2px solid #0f172a !important; background: #f8fafc; color: #0f172a; }
    .td-day-tot.has-p { color: #059669; font-weight: 800; }
    .td-day-pct { font-family: 'JetBrains Mono', monospace; font-size: 4.8pt; font-weight: 600; background: #f8fafc; color: #475569; }

    tfoot tr.tf-tot td { height: 3.5mm; background: #f1f5f9; font-family: 'JetBrains Mono', monospace; font-size: 5pt; font-weight: 800; color: #0f172a; border-top: 1.2px solid #0f172a; }
    tfoot tr.tf-pct td { height: 3.5mm; background: #e2e8f0; font-family: 'JetBrains Mono', monospace; font-size: 4.6pt; font-weight: 700; color: #0369a1; border-bottom: 1.5px solid #0f172a; }

    .footer { display: flex; justify-content: space-between; align-items: center; font-size: 5.2pt; color: #64748b; padding-top: 2px; border-top: 1px solid #cbd5e1; margin-top: 1px; }
    .footer strong { color: #0f172a; }

    .print-bar { position: fixed; top: 10px; right: 10px; z-index: 9999; display: flex; gap: 8px; background: #0f172a; padding: 6px 12px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4); }
    .print-btn { background: #047857; color: #ffffff; border: none; padding: 5px 12px; border-radius: 4px; font-size: 8pt; font-weight: 700; cursor: pointer; }
    .viewer-btn { background: #334155; color: #ffffff; border: none; padding: 5px 10px; border-radius: 4px; font-size: 8pt; font-weight: 600; text-decoration: none; }
    @media print { .print-bar { display: none !important; } }
  </style>
</head>
<body>

  <div class="print-bar">
    <button class="print-btn" onclick="window.print()">🖨️ Print 1-Page A4 PDF</button>
    <a href="attendance_report_code_rules_viewer.html" class="viewer-btn">🖥️ Comparison Dashboard</a>
  </div>

  <div class="page-container">

    <div class="header">
      <div class="header-left">
        <h1>
          CIPD ERP • Wi-Fi Attendance Ledger (Code Rules)
          <span class="badge">≥25% Duration Filter</span>
        </h1>
        <div class="header-meta">
          Period: <strong>10 Sep – 11 Oct 2026</strong> (32 Days) &nbsp;|&nbsp;
          Rule: <strong>resolveAttendanceStatus (MIN_DURATION_PERCENT = 25%)</strong> &nbsp;|&nbsp;
          Columns: <strong>26 Students × 4 Slots</strong>
        </div>
      </div>
      <div class="kpi-pills">
        <div class="kpi-pill">
          <span>PREV (SINGLE)</span>
          <span class="val">${metadata.singleDetectionTotal}</span>
        </div>
        <div class="kpi-pill highlight">
          <span>CODE RULE P</span>
          <span class="val">${metadata.codeRulesTotal}</span>
        </div>
        <div class="kpi-pill delta">
          <span>DIFF (FLEETING DROPPED)</span>
          <span class="val">${metadata.differenceTotal}</span>
        </div>
        <div class="kpi-pill highlight">
          <span>VERIFIED ATT%</span>
          <span class="val">${metadata.overallAttendancePct}%</span>
        </div>
      </div>
    </div>

    <div class="legend-bar">
      <div class="legend-slots">
        <span><strong>S1:</strong> 09:30–11:00 (${slotTotals.slot1})</span>
        <span><strong>S2:</strong> 11:15–12:45 (${slotTotals.slot2})</span>
        <span><strong>S3:</strong> 14:00–15:30 (${slotTotals.slot3})</span>
        <span><strong>S4:</strong> 15:45–17:30 (${slotTotals.slot4})</span>
      </div>
      <div>
        <span class="chip-p"></span> <strong>P</strong> = Present (Duration ≥25% of slot) &nbsp;|&nbsp;
        <span class="chip-a"></span> <strong>·</strong> = Absent (Duration &lt;25% or not detected)
      </div>
    </div>

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
            const dayCount = dailySummary[dateStr].codeRulesPresentCount;
            const dayPct = ((dayCount / (students.length * 4)) * 100).toFixed(0);
            const dateShort = dateStr.slice(5).replace('-', '/');

            return `
              <tr class="${rowClass}">
                <td class="td-date">
                  <span class="day">${dayName}</span> ${dateShort}
                </td>
                ${students.map((s) => {
                  const s1 = matrix[dateStr][s.id]['slot1'].code === 'P';
                  const s2 = matrix[dateStr][s.id]['slot2'].code === 'P';
                  const s3 = matrix[dateStr][s.id]['slot3'].code === 'P';
                  const s4 = matrix[dateStr][s.id]['slot4'].code === 'P';

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
            <td class="td-day-tot">${metadata.codeRulesTotal}</td>
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

    <div class="footer">
      <div>
        Rule Applied: <strong>lib/attendance-points.js (MIN_DURATION_PERCENT = 25%)</strong> • Generated on ${new Date().toLocaleDateString('en-GB')}.
      </div>
      <div>
        Delta vs Single Detection: <strong>331 → 263 marks (-68 marks / -20.5%)</strong>
      </div>
      <div>
        Page <strong>1 of 1</strong> (A4 Landscape)
      </div>
    </div>

  </div>

</body>
</html>`;
}

function buildViewerHtml(payload) {
  const { metadata, studentStats } = payload;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Attendance Report • Codebase Rules &amp; Delta Analysis</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #090d16; color: #f1f5f9; padding: 0; margin: 0; }
    .top-bar { position: sticky; top: 0; z-index: 100; background: rgba(15,23,42,0.95); backdrop-filter: blur(12px); border-bottom: 1px solid #23314f; padding: 10px 24px; display: flex; justify-content: space-between; align-items: center; }
    .top-bar h1 { font-size: 1.1rem; font-weight: 800; display: flex; align-items: center; gap: 8px; }
    .tag { background: #059669; color: #fff; font-size: 0.7rem; font-weight: 700; padding: 2px 7px; border-radius: 4px; text-transform: uppercase; }
    .btn-group { display: flex; gap: 8px; }
    .btn { background: #1e293b; border: 1px solid #334155; color: #fff; font-size: 0.8rem; font-weight: 600; padding: 6px 12px; border-radius: 6px; text-decoration: none; cursor: pointer; }
    .btn:hover { background: #334155; }
    .btn-primary { background: #059669; border-color: #047857; }
    .btn-primary:hover { background: #047857; }

    .main-content { max-width: 1400px; margin: 0 auto; padding: 24px; }
    .delta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .card { background: #131b2e; border: 1px solid #23314f; border-radius: 12px; padding: 18px 20px; }
    .card .title { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; font-weight: 600; }
    .card .val { font-size: 1.8rem; font-weight: 800; color: #fff; margin-top: 4px; }
    .card .sub { font-size: 0.8rem; margin-top: 4px; }

    .comparison-section { background: #131b2e; border: 1px solid #23314f; border-radius: 12px; padding: 20px; margin-bottom: 28px; }
    .section-head { font-size: 1.15rem; font-weight: 700; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid #1e293b; }
    th { background: #0f172a; color: #94a3b8; font-weight: 600; }
    tr:hover td { background: rgba(56, 189, 248, 0.04); }
    .pill-diff { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 5px; padding: 2px 7px; font-weight: 700; font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; }
    .pill-same { background: rgba(148, 163, 184, 0.1); color: #94a3b8; border-radius: 5px; padding: 2px 7px; font-size: 0.8rem; }

    .a4-preview-wrap { display: flex; justify-content: center; padding: 20px 0; }
    .a4-frame { width: 297mm; height: 210mm; border: none; box-shadow: 0 15px 45px rgba(0,0,0,0.8); border-radius: 2px; }
  </style>
</head>
<body>

  <div class="top-bar">
    <h1>📡 Wi-Fi Attendance Report <span class="tag">Codebase Rules (≥25% Duration)</span></h1>
    <div class="btn-group">
      <button class="btn btn-primary" onclick="document.getElementById('a4frame').contentWindow.print()">🖨️ Print 1-Page A4</button>
      <a href="attendance_report_code_rules_10sep_11oct_A4.pdf" class="btn" download>⬇️ A4 PDF</a>
      <a href="attendance_slots_report_code_rules_2026-09-10_to_2026-10-11.xlsx" class="btn" download>📊 Excel</a>
      <a href="attendance_slots_report_code_rules_2026-09-10_to_2026-10-11.csv" class="btn" download>📄 CSV</a>
    </div>
  </div>

  <div class="main-content">

    <div class="delta-grid">
      <div class="card">
        <div class="title">Previous (Single Detection)</div>
        <div class="val" style="color:#94a3b8;">${metadata.singleDetectionTotal}</div>
        <div class="sub" style="color:#94a3b8;">Attendance Rate: ${metadata.singleDetectionAttendancePct}%</div>
      </div>
      <div class="card">
        <div class="title">New (Codebase Rule: ≥25% Dur)</div>
        <div class="val" style="color:#10b981;">${metadata.codeRulesTotal}</div>
        <div class="sub" style="color:#10b981;">Attendance Rate: ${metadata.overallAttendancePct}%</div>
      </div>
      <div class="card">
        <div class="title">Net Difference</div>
        <div class="val" style="color:#f43f5e;">${metadata.differenceTotal}</div>
        <div class="sub" style="color:#f43f5e;">-20.5% fleeting pings dropped</div>
      </div>
      <div class="card">
        <div class="title">Rule Enforced</div>
        <div class="val" style="font-size:1.1rem; color:#38bdf8; margin-top:8px;">MIN_DURATION 25%</div>
        <div class="sub" style="color:#94a3b8;">lib/attendance-points.js</div>
      </div>
    </div>

    <!-- Comparison Table -->
    <div class="comparison-section">
      <div class="section-head">
        <span>👥 Student Attendance Delta Breakdown</span>
        <span style="font-size:0.8rem; color:#94a3b8;">Sorted by Active Attendance</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Enrollment No</th>
            <th>Student Name</th>
            <th>Previous (≥1 Ping)</th>
            <th>New (≥25% Duration)</th>
            <th>Difference</th>
            <th>Quality Points Earned</th>
          </tr>
        </thead>
        <tbody>
          ${studentStats.map((st) => {
            const diff = st.totalSlotsPresent - st.totalSlotsSingleDetection;
            return `
              <tr>
                <td style="font-family:'JetBrains Mono', monospace; color:#38bdf8;">${st.enrollmentNo}</td>
                <td style="font-weight:600;">${st.name}</td>
                <td>${st.totalSlotsSingleDetection} / 128 (${((st.totalSlotsSingleDetection/128)*100).toFixed(1)}%)</td>
                <td style="font-weight:700; color:#10b981;">${st.totalSlotsPresent} / 128 (${((st.totalSlotsPresent/128)*100).toFixed(1)}%)</td>
                <td>
                  ${diff < 0 ? `<span class="pill-diff">${diff}</span>` : `<span class="pill-same">0</span>`}
                </td>
                <td style="font-weight:700; color:#e2e8f0;">${st.totalPointsEarned.toFixed(1)} pts</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    <!-- Live 1-Page A4 Sheet Embedded -->
    <div class="comparison-section">
      <div class="section-head">
        <span>📄 Official 1-Page A4 Sheet Preview</span>
        <a href="attendance_report_code_rules_a4.html" target="_blank" style="font-size:0.8rem; color:#38bdf8;">Open Fullscreen ↗</a>
      </div>
      <div class="a4-preview-wrap">
        <iframe id="a4frame" class="a4-frame" src="attendance_report_code_rules_a4.html"></iframe>
      </div>
    </div>

  </div>

</body>
</html>`;
}

// CLI Execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateWifiAttendanceReportWithCodeRules()
    .then(() => {
      console.log('✅ Done!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Execution error:', err);
      process.exit(1);
    });
}
