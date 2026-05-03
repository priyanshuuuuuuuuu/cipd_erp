// ============================================================
// CIPD ERP — NEW Attendance Ingestion Script
// Master-Prioritized Positional Matching
//
// Reads attendance Excel → matches to DB sessions by (date, slot position)
// → upserts student_attendance_marks → computes & upserts course attendance %
//
// DOES NOT touch the sessions table.
//
// Usage:
//   node ingest-attendance-new.js            # production run
//   DRY_RUN=1 node ingest-attendance-new.js  # dry run (no DB writes)
//   DEBUG=1 node ingest-attendance-new.js     # verbose logging
// ============================================================

'use strict';

// ─── Force node-fetch@2 ────────────────────────────────────
let nodeFetch;
try {
  nodeFetch = require('node-fetch');
  globalThis.fetch    = nodeFetch.default || nodeFetch;
  globalThis.Headers  = nodeFetch.Headers;
  globalThis.Request  = nodeFetch.Request;
  globalThis.Response = nodeFetch.Response;
} catch (e) {
  console.error('❌ node-fetch not found. Run: npm install node-fetch@2');
  process.exit(1);
}

const path  = require('path');
const XLSX  = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

// ─── CONFIG ────────────────────────────────────────────────
const XLSX_PATH = 'C:\\Users\\parsh\\OneDrive\\Desktop\\BTP\\Attendance _ iPD-CP(Jan-Jun 2026).xlsx';

const SUPABASE_URL         = 'https://pvqxzbabstyhskhydbvl.supabase.co';
const SUPABASE_SERVICE_KEY = '[REMOVED-ROTATED]';

const DRY_RUN = process.env.DRY_RUN === '1';
const DEBUG   = process.env.DEBUG   === '1';

// Sheets to process (May/Jun are empty)
const SHEETS_TO_PROCESS = ['Jan 2026', 'Feb 2026', 'Mar 2026', 'April 2026'];

// Jan & Feb: attendance tracks capstone → include ALL master sessions in positional match
// Mar & Apr: attendance does NOT track capstone → exclude Capstone from master before matching
const INCLUDE_CAPSTONE_SHEETS = new Set(['Jan 2026', 'Feb 2026']);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
  global: { fetch: globalThis.fetch },
});

// ─── HELPERS ───────────────────────────────────────────────

function dbg(...a) { if (DEBUG) console.log('  [DBG]', ...a); }

function normalizeName(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Maps raw Excel attendance code → canonical status string.
 * Returns null for blank / unrecognized (skip).
 */
function mapStatus(raw) {
  if (!raw) return null;
  const c = String(raw).trim().toUpperCase().replace(/\s+/g, '');
  if (c === 'P')                     return 'P';
  if (c === 'P(O)' || c === 'PO')   return 'PO';
  if (c === 'H')                     return 'H';
  if (c === 'A')                     return 'A';
  if (c === 'L')                     return 'L';
  if (c === 'C')                     return 'C';
  return null;
}

/**
 * Parses dates: "1/5/26", "1/5/2026", "05-01-2026" → "2026-01-05"
 */
function parseDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();

  // DD-MM-YYYY
  const m1 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m1) {
    let [, p1, p2, year] = m1;
    p1 = parseInt(p1); p2 = parseInt(p2);
    const day   = p1 > 12 ? p1 : (p2 > 12 ? p2 : p1);
    const month = p1 > 12 ? p2 : (p2 > 12 ? p1 : p2);
    return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }

  // M/D/YY or M/D/YYYY
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m2) {
    const month = parseInt(m2[1]);
    const day   = parseInt(m2[2]);
    let   year  = parseInt(m2[3]);
    if (year < 100) year += 2000;
    return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }
  return null;
}

/** ISO year-week key: "2026-W03" */
function isoWeekKey(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const thu = new Date(d);
  thu.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const yearStart = new Date(Date.UTC(thu.getUTCFullYear(), 0, 4));
  const wk = Math.ceil(((thu - yearStart) / 86400000 + 1) / 7);
  return `${thu.getUTCFullYear()}-W${String(wk).padStart(2, '0')}`;
}

/** Expand merged cells in worksheet → 2D array */
function expandMerges(ws) {
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
  for (const mg of (ws['!merges'] || [])) {
    const val = data[mg.s.r]?.[mg.s.c] ?? '';
    for (let r = mg.s.r; r <= mg.e.r; r++) {
      if (!data[r]) data[r] = [];
      for (let c = mg.s.c; c <= mg.e.c; c++) data[r][c] = val;
    }
  }
  return data;
}

// ─── FETCH STUDENTS FROM DB ────────────────────────────────

async function fetchStudentMap() {
  // Connectivity check
  try {
    const res = await globalThis.fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
    });
    if (!res.ok && res.status !== 200 && res.status !== 404) {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (e) {
    throw new Error(`Cannot reach Supabase: ${e.message}`);
  }

  const { data, error } = await supabase
    .from('students')
    .select('id, enrollment_no, users(first_name, last_name)');
  if (error) throw new Error('fetchStudentMap: ' + error.message);

  const byName = {};
  const byEnrollment = {};
  for (const s of data) {
    const fn   = s.users?.first_name || '';
    const ln   = s.users?.last_name  || '';
    const full = `${fn} ${ln}`.trim();
    const norm = normalizeName(full);
    const rec  = { id: s.id, enrollment_no: s.enrollment_no, fullName: full };
    byName[norm] = rec;
    if (s.enrollment_no) byEnrollment[s.enrollment_no] = rec;
  }
  return { byName, byEnrollment };
}

function resolveStudent(excelName, sno, sm) {
  const norm = normalizeName(excelName);
  if (sm.byName[norm]) return sm.byName[norm];
  // Prefix fuzzy
  const fuzzy = Object.keys(sm.byName).find(k =>
    k.startsWith(norm) || norm.startsWith(k));
  if (fuzzy) return sm.byName[fuzzy];
  // Enrollment fallback
  const en = `iPDCP2026W${sno}`;
  if (sm.byEnrollment[en]) return sm.byEnrollment[en];
  return null;
}

// ─── FETCH ALL SESSIONS FROM DB (MASTER) ───────────────────

async function fetchSessionsByDate() {
  console.log('📅 Fetching sessions from DB (master)...');

  // Supabase caps at 1000 rows by default; fetch in pages
  let allSessions = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('sessions')
      .select('id, course_id, session_date, start_time, session_types(name)')
      .order('session_date', { ascending: true })
      .order('start_time', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error('fetchSessions: ' + error.message);
    allSessions = allSessions.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  console.log(`   ${allSessions.length} sessions loaded from DB`);

  // Group by date, sorted by start_time
  const byDate = {};
  for (const s of allSessions) {
    const d = s.session_date;
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push({
      id:       s.id,
      courseId:  s.course_id,
      startTime: s.start_time,
      typeName: s.session_types?.name || '',
    });
  }
  for (const d of Object.keys(byDate)) {
    byDate[d].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }
  return byDate;
}

// ─── BUILD MARKS FROM ONE SHEET ────────────────────────────

function buildMarksFromSheet(sheetName, data, sessionsByDate, studentMap) {
  const dateRow    = data[1] || [];
  const domainRow  = data[3] || [];
  const sessionRow = data[5] || [];

  const includeCapstone = INCLUDE_CAPSTONE_SHEETS.has(sheetName);
  const marks = [];
  const unmatchedStudents = new Set();
  let linked = 0, unlinked = 0;

  // ── Build column descriptors ──
  const columns = [];
  let lastDate = null;

  for (let c = 2; c < Math.max(dateRow.length, sessionRow.length, domainRow.length); c++) {
    const rawDate    = String(dateRow[c]    || '').trim();
    const rawDomain  = String(domainRow[c]  || '').trim();
    const rawSession = String(sessionRow[c] || '').trim();

    if (rawDate) { const d = parseDate(rawDate); if (d) lastDate = d; }
    if (!lastDate || !rawSession.startsWith('Session')) continue;

    const slotNum = parseInt(rawSession.replace('Session ', ''), 10);
    if (isNaN(slotNum)) continue;

    columns.push({
      colIndex: c,
      date: lastDate,
      slotNum,
      sourceDomain: rawDomain,
      isoWeek: isoWeekKey(lastDate),
      // Resolved later:
      sessionId: null,
      courseId: null,
    });
  }

  // ── Resolve each column → master session ──
  for (const col of columns) {
    const daySessions = sessionsByDate[col.date] || [];

    // Filter: for Mar/Apr exclude Capstone from master
    const filtered = includeCapstone
      ? daySessions
      : daySessions.filter(s => s.typeName !== 'Capstone');

    // Positional match: Session 01 → filtered[0], Session 02 → filtered[1], etc.
    const match = filtered[col.slotNum - 1] || null;

    if (match) {
      col.sessionId = match.id;
      col.courseId   = match.courseId;
      linked++;
    } else {
      unlinked++;
      dbg(`No match: ${col.date} slot=${col.slotNum} domain="${col.sourceDomain}" ` +
          `(master has ${daySessions.length} sessions, ${filtered.length} after filter)`);
    }
  }

  // ── Read student rows (0-indexed 6..23) ──
  for (let r = 6; r <= 23; r++) {
    const row  = data[r] || [];
    const sno  = String(row[0] || '').trim();
    const name = String(row[1] || '').trim();
    if (!sno || !name || isNaN(parseInt(sno, 10))) continue;

    const student = resolveStudent(name, sno, studentMap);
    if (!student) { unmatchedStudents.add(name); continue; }

    for (const col of columns) {
      const rawCode = String(row[col.colIndex] || '').trim();
      const status  = mapStatus(rawCode);
      if (!status) continue;

      marks.push({
        studentId:    student.id,
        sessionDate:  col.date,
        sessionSlot:  col.slotNum,
        status,
        sessionId:    col.sessionId,
        courseId:      col.courseId,
        sourceDomain: col.sourceDomain,
        sourceSheet:  sheetName,
        isoWeek:      col.isoWeek,
        _name:        name, // debug only
      });
    }
  }

  return { marks, unmatchedStudents, linked, unlinked };
}

// ─── WEEKLY C-LIMIT RULE ───────────────────────────────────
// 1st & 2nd C per (student, ISO week) → keep as 'C' (+1.0 points)
// 3rd+ C → convert to 'L' (+0.0 points)

function applyWeeklyCLimit(marks) {
  // Sort chronologically per student for deterministic ordering
  marks.sort((a, b) =>
    a.studentId.localeCompare(b.studentId) ||
    a.sessionDate.localeCompare(b.sessionDate) ||
    a.sessionSlot - b.sessionSlot
  );

  const cCounts = {}; // 'studentId||week' → count
  let converted = 0;

  for (const m of marks) {
    if (m.status !== 'C') continue;
    const key = `${m.studentId}||${m.isoWeek}`;
    cCounts[key] = (cCounts[key] || 0) + 1;
    if (cCounts[key] >= 3) {
      dbg(`C-limit: ${m._name} ${m.isoWeek} slot=${m.sessionSlot} C#${cCounts[key]}→L`);
      m.status = 'L';
      converted++;
    }
  }
  return converted;
}

// ─── UPSERT student_attendance_marks ───────────────────────

async function upsertMarks(marks) {
  // Deduplicate by (student_id, session_date, session_slot) — last occurrence wins.
  // A single batch with two rows sharing the same conflict key causes Postgres to error.
  const seen = new Map();
  for (const m of marks) {
    const key = `${m.studentId}||${m.sessionDate}||${m.sessionSlot}`;
    seen.set(key, m); // overwrite → last wins
  }
  const deduped = [...seen.values()];
  if (deduped.length < marks.length) {
    console.log(`   Deduplicated ${marks.length - deduped.length} duplicate marks`);
  }

  const rows = deduped.map(m => ({
    student_id:    m.studentId,
    session_date:  m.sessionDate,
    session_slot:  m.sessionSlot,
    status:        m.status,
    session_id:    m.sessionId,
    course_id:     m.courseId,
    source_domain: m.sourceDomain,
    source_sheet:  m.sourceSheet,
    iso_week:      m.isoWeek,
  }));

  const BATCH = 200;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase
      .from('student_attendance_marks')
      .upsert(rows.slice(i, i + BATCH), { onConflict: 'student_id,session_date,session_slot' });
    if (error) throw new Error('upsert student_attendance_marks: ' + error.message);
    process.stdout.write(`\r   Marks upserted: ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }
  console.log();
}

// ─── COMPUTE & UPSERT student_course_attendance ────────────

function computePercentages(marks) {
  const stats = {}; // 'studentId||courseId' → { points, total }

  for (const m of marks) {
    if (!m.courseId) continue; // unlinked → skip
    const key = `${m.studentId}||${m.courseId}`;
    if (!stats[key]) stats[key] = { studentId: m.studentId, courseId: m.courseId, points: 0, total: 0 };

    stats[key].total += 1;
    switch (m.status) {
      case 'P':  case 'PO': stats[key].points += 1.0;  break;
      case 'H':             stats[key].points += 0.5;  break;
      case 'A':             stats[key].points -= 1.0;  break;
      case 'L':             /* +0.0 */                  break;
      case 'C':             stats[key].points += 1.0;  break; // 1st/2nd C
    }
  }

  return Object.values(stats).map(s => ({
    student_id:            s.studentId,
    course_id:             s.courseId,
    attendance_percentage: s.total > 0
      ? parseFloat(((s.points / s.total) * 100).toFixed(4))
      : 0,
    updated_at: new Date().toISOString(),
  }));
}

async function upsertCourseAttendance(rows) {
  const BATCH = 200;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase
      .from('student_course_attendance')
      .upsert(rows.slice(i, i + BATCH), { onConflict: 'student_id,course_id' });
    if (error) throw new Error('upsert student_course_attendance: ' + error.message);
    process.stdout.write(`\r   Course attendance: ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }
  console.log();
}

// ─── MAIN ──────────────────────────────────────────────────

async function main() {
  console.log('🚀 CIPD ERP — New Attendance Ingestion (Master-Prioritized)');
  console.log('============================================================');
  if (DRY_RUN) console.log('🔍 DRY RUN — no DB writes');
  if (DEBUG)   console.log('🐛 Debug mode ON');

  // ── Read workbook ──
  console.log(`\n📂 Reading: ${path.basename(XLSX_PATH)}`);
  const wb = XLSX.readFile(XLSX_PATH, { cellDates: false, sheetStubs: true });
  console.log(`   Sheets: ${wb.SheetNames.join(', ')}`);

  // ── Fetch students ──
  console.log('\n👥 Fetching students...');
  const studentMap = await fetchStudentMap();
  console.log(`   ${Object.keys(studentMap.byName).length} students loaded`);

  // ── Fetch master sessions ──
  const sessionsByDate = await fetchSessionsByDate();
  const totalDates = Object.keys(sessionsByDate).length;
  console.log(`   ${totalDates} unique dates with sessions`);

  // ── Process each sheet ──
  const allMarks = [];
  const allUnmatched = new Set();
  let totalLinked = 0, totalUnlinked = 0;

  for (const sheetName of SHEETS_TO_PROCESS) {
    if (!wb.Sheets[sheetName]) {
      console.warn(`\n⚠️  Sheet "${sheetName}" not found, skipping`);
      continue;
    }
    console.log(`\n📋 Processing: ${sheetName}`);
    const ws   = wb.Sheets[sheetName];
    const data = expandMerges(ws);
    const { marks, unmatchedStudents, linked, unlinked } =
      buildMarksFromSheet(sheetName, data, sessionsByDate, studentMap);

    unmatchedStudents.forEach(s => allUnmatched.add(s));
    allMarks.push(...marks);
    totalLinked   += linked;
    totalUnlinked += unlinked;

    console.log(`   ${marks.length} marks | columns: ${linked} linked, ${unlinked} unlinked`);
    if (unmatchedStudents.size > 0) {
      console.warn(`   ⚠️  Unmatched students: ${[...unmatchedStudents].join(', ')}`);
    }
  }

  // ── Apply C-limit ──
  console.log('\n⚖️  Applying weekly C-limit rule...');
  const converted = applyWeeklyCLimit(allMarks);
  console.log(`   ${converted} marks converted C→L`);

  // ── Status breakdown ──
  const statusCounts = {};
  for (const m of allMarks) statusCounts[m.status] = (statusCounts[m.status] || 0) + 1;
  console.log('\n📊 Status breakdown (after C-limit):');
  for (const [s, c] of Object.entries(statusCounts).sort((a,b) => b[1]-a[1])) {
    console.log(`   ${s}: ${c}`);
  }

  // ── Compute percentages ──
  const pctRows = computePercentages(allMarks);

  if (DRY_RUN) {
    console.log(`\n🔍 DRY RUN — would upsert ${allMarks.length} marks, ${pctRows.length} course rows`);
    console.log('\n   Sample course attendance:');
    for (const p of pctRows.slice(0, 10)) {
      console.log(`   student=${p.student_id.slice(0,8)}… course=${p.course_id.slice(0,8)}… pct=${p.attendance_percentage}%`);
    }
  } else {
    // ── Upsert marks ──
    console.log('\n📝 Upserting attendance marks...');
    await upsertMarks(allMarks);

    // ── Upsert course attendance ──
    console.log('\n📊 Upserting course attendance percentages...');
    await upsertCourseAttendance(pctRows);
  }

  // ── Summary ──
  console.log('\n============================================================');
  console.log('✅ INGESTION COMPLETE');
  console.log('============================================================');
  console.log(`📝 Total marks:          ${allMarks.length}`);
  console.log(`🔗 Columns linked:       ${totalLinked}`);
  console.log(`❌ Columns unlinked:     ${totalUnlinked}`);
  console.log(`📊 Course attendance:    ${pctRows.length} rows`);
  console.log(`⚖️  C→L conversions:     ${converted}`);

  if (allUnmatched.size > 0) {
    console.warn(`\n⚠️  Unmatched students (${allUnmatched.size}):`);
    allUnmatched.forEach(s => console.warn(`   - "${s}"`));
  } else {
    console.log('✅ All students matched');
  }

  console.log('\n🔍 Validation queries:');
  console.log("   SELECT COUNT(*) FROM student_attendance_marks;");
  console.log("   SELECT status, COUNT(*) FROM student_attendance_marks GROUP BY status ORDER BY count DESC;");
  console.log("   SELECT COUNT(*) FILTER (WHERE session_id IS NOT NULL) AS linked, COUNT(*) FILTER (WHERE session_id IS NULL) AS unlinked FROM student_attendance_marks;");
}

main().catch(err => {
  console.error('\n💥 Fatal:', err.message);
  if (DEBUG) console.error(err.stack);
  process.exit(1);
});
