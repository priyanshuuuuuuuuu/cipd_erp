// ============================================================
// CIPD ERP — Attendance Ingestion Script (ingest-xlsx.js)
// Reads Excel workbook → seeds sessions, attendance_records,
// and student_course_attendance in Supabase.
//
// Usage:         node ingest-xlsx.js
// Debug (verbose): DEBUG=1 node ingest-xlsx.js
// ============================================================

'use strict';

// ─── FORCE node-fetch@2 for ALL Node versions ─────────────────
// Node 22's native fetch has SSL compatibility issues on Windows.
// node-fetch@2 uses Node's proven https module and works reliably.
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
const { v4: uuidv4 }   = require('uuid');

// ─── CONFIG ──────────────────────────────────────────────────
const XLSX_PATH = 'C:\\Users\\parsh\\OneDrive\\Desktop\\BTP\\Attendance _ iPD-CP(Jan-Jun 2026).xlsx';

<<<<<<< HEAD
const SUPABASE_URL         = process.env.SUPABASE_URL || 'https://pvqxzbabstyhskhydbvl.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_SERVICE_KEY) throw new Error('SUPABASE_SERVICE_KEY env var is not set. Add it to .env before running.');
=======
const SUPABASE_URL         = 'https://pvqxzbabstyhskhydbvl.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
>>>>>>> 7658f2ac563b0494eb5d492cf1cc267b94a33e63

const DEBUG = process.env.DEBUG === '1';

// Session time slots
const SESSION_TIMES = {
  'Session 01': { start: '09:00:00', end: '10:30:00' },
  'Session 02': { start: '10:45:00', end: '12:15:00' },
  'Session 03': { start: '13:00:00', end: '14:30:00' },
};
const DEFAULT_TIMES = { start: '09:00:00', end: '10:30:00' };

// Confirmed course name → UUID map
const COURSE_IDS = {
  'business & leadership':    '4807a11a-5ed1-4554-be1c-a5a56afe9fa7',
  'design & ui':              'ee8f3178-44ec-4172-bff2-94b481f4fa92',
  'electronics and basics':   '4c69904f-e286-4e99-bf7b-966157899abb',
  'embedded systems and iot': '81c5903a-8eea-4dce-a34b-b8040fcae15a',
  'entrepreneurship':         '2bcf9d6d-1e14-491f-abac-ab1d6fc40c76',
  'product development':      '89f61edb-96f4-4fec-a026-17599f668be4',
  'software & app dev':       '9b072a17-ce54-4bfe-a7cc-c692dfa61e3f',
};
// ─────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
  global: { fetch: globalThis.fetch },
});

// ─── HELPERS ─────────────────────────────────────────────────

function dbg(...args) { if (DEBUG) console.log(...args); }

function normalizeName(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Fuzzy course name → { id, canonicalName } */
function resolveCourse(rawName) {
  if (!rawName || !rawName.trim()) return null;
  const n = rawName.trim().toLowerCase();
  if (COURSE_IDS[n]) return { id: COURSE_IDS[n], name: rawName.trim() };
  // Substring match — ordered most-specific first
  const subs = [
    ['embedded systems', 'embedded systems and iot'],
    ['electronics',      'electronics and basics'],
    ['business',         'business & leadership'],
    ['design',           'design & ui'],
    ['software',         'software & app dev'],
    ['product',          'product development'],
    ['entrepren',        'entrepreneurship'],
  ];
  for (const [sub, key] of subs) {
    if (n.includes(sub)) {
      const canonicalName = Object.keys(COURSE_IDS).find(k => k === key);
      return { id: COURSE_IDS[key], name: canonicalName || key };
    }
  }
  return null;
}

/** Maps P / P(o) / H / A / L / C → DB enum value */
function mapStatus(raw) {
  if (!raw) return null;
  const c = String(raw).trim().toUpperCase().replace(/\s+/g, '');
  if (c === 'P')                     return 'present';
  if (c === 'P(O)' || c === 'P(o)') return 'present_online';
  if (c === 'H')                     return 'half';
  if (c === 'A')                     return 'absent';
  if (c === 'L')                     return 'leave';
  if (c === 'C')                     return 'other';
  return null; // blank, "No Session", holidays → skip
}

/** Parses dates in multiple formats → YYYY-MM-DD
 *  Handles:
 *    "05-01-2026"  (DD-MM-YYYY — original expected format)
 *    "1/5/26"      (M/D/YY    — what xlsx outputs for Excel date serials on Windows)
 *    "1/5/2026"    (M/D/YYYY  — same but 4-digit year)
 */
function parseDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();

  // Format 1: DD-MM-YYYY  e.g. "05-01-2026"
  const m1 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m1) {
    let [, p1, p2, year] = m1;
    p1 = parseInt(p1, 10); p2 = parseInt(p2, 10);
    const day   = p1 > 12 ? p1 : (p2 > 12 ? p2 : p1);
    const month = p1 > 12 ? p2 : (p2 > 12 ? p1 : p2);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // Format 2: M/D/YY or M/D/YYYY  e.g. "1/5/26" or "1/5/2026"
  // This is what the xlsx library outputs when Excel stores dates as date serials
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m2) {
    const month = parseInt(m2[1], 10);
    const day   = parseInt(m2[2], 10);
    let   year  = parseInt(m2[3], 10);
    if (year < 100) year += 2000; // "26" → 2026
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  return null;
}

/** Returns ISO year-week key like "2026-W03" from a YYYY-MM-DD string */
function isoWeekKey(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const thu = new Date(d);
  thu.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const yearStart = new Date(Date.UTC(thu.getUTCFullYear(), 0, 4));
  const wk = Math.ceil(((thu - yearStart) / 86400000 + 1) / 7);
  return `${thu.getUTCFullYear()}-W${String(wk).padStart(2, '0')}`;
}

/** Expands all merged cells; returns 2-D array with no blank-from-merge cells */
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

// ─── PHASE 2: Fetch student map from DB ──────────────────────

async function fetchStudentMap() {
  // Quick connectivity check — gives a clearer error if Supabase is unreachable
  try {
    const pingUrl = `${SUPABASE_URL}/rest/v1/`;
    const res = await globalThis.fetch(pingUrl, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
    });
    if (!res.ok && res.status !== 200 && res.status !== 404) {
      throw new Error(`Supabase returned HTTP ${res.status} — check your URL and service key.`);
    }
  } catch (pingErr) {
    throw new Error(
      `Cannot reach Supabase at ${SUPABASE_URL}\n` +
      `  Underlying error: ${pingErr.message}\n` +
      `  → Check: (1) Internet connection, (2) Supabase project is not paused, (3) URL/key are correct.`
    );
  }

  // students.id is FK → users.id, so Supabase resolves the join
  const { data, error } = await supabase
    .from('students')
    .select('id, enrollment_no, users(first_name, last_name)');
  if (error) throw new Error('fetchStudentMap: ' + error.message);

  const byName       = {}; // normalizedFullName → student record
  const byEnrollment = {}; // enrollmentNo       → student record

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
  // 1. Exact normalized name
  if (sm.byName[norm]) return sm.byName[norm];
  // 2. Prefix fuzzy match
  const fuzzy = Object.keys(sm.byName).find(k =>
    k.startsWith(norm) || norm.startsWith(k));
  if (fuzzy) return sm.byName[fuzzy];
  // 3. Enrollment-no fallback
  const en = `iPDCP2026W${sno}`;
  if (sm.byEnrollment[en]) return sm.byEnrollment[en];
  return null;
}

// ─── PHASE 3: Build column map from one sheet ────────────────
// Row layout (0-indexed):
//  0 → Week number (ignored — we derive week from date)
//  1 → Date  (DD-MM-YYYY, merged across sessions of same day)
//  2 → Day name
//  3 → Course name (merged)
//  4 → Session label (Session 01 / 02 / 03)
//  5+ → Student rows  (col 0 = Sno, col 1 = Name, col 2+ = codes)

function buildColumnMap(data) {
  const dateRow    = data[1] || [];
  const courseRow  = data[3] || [];
  const sessionRow = data[4] || [];
  const maxCol = Math.max(dateRow.length, courseRow.length, sessionRow.length);

  const columns = [];
  const unmatchedCourses = new Set();
  let lastDate = null;

  for (let c = 2; c < maxCol; c++) {
    const rawDate    = String(dateRow[c]    || '').trim();
    const rawCourse  = String(courseRow[c]  || '').trim();
    const rawSession = String(sessionRow[c] || '').trim();

    if (rawDate) { const d = parseDate(rawDate); if (d) lastDate = d; }
    if (!lastDate || !rawSession.startsWith('Session')) continue;

    const course = resolveCourse(rawCourse);
    if (!course) {
      if (rawCourse) unmatchedCourses.add(rawCourse);
      continue;
    }

    columns.push({
      colIndex:     c,
      date:         lastDate,
      courseId:     course.id,
      courseName:   course.name,
      sessionLabel: rawSession,
      isoWeek:      isoWeekKey(lastDate),
    });
  }
  return { columns, unmatchedCourses };
}

// ─── PHASE 4: Upsert sessions ────────────────────────────────

async function upsertSessions(allColumns) {
  // Deduplicate in memory
  const unique = new Map(); // key → colDescriptor
  for (const col of allColumns) {
    const key = `${col.courseId}||${col.date}||${col.sessionLabel}`;
    if (!unique.has(key)) unique.set(key, col);
  }

  // Fetch sessions that may already exist (idempotency)
  const courseIds = [...new Set(allColumns.map(c => c.courseId))];
  const { data: existing, error: fetchErr } = await supabase
    .from('sessions')
    .select('id, course_id, session_date, title')
    .in('course_id', courseIds);
  if (fetchErr) throw new Error('upsertSessions fetch: ' + fetchErr.message);

  const sessionMap = new Map(); // key → sessionId
  for (const s of existing) {
    // Reconstruct key from title: last token = "Session NN"
    const m = (s.title || '').match(/(Session \d+)$/);
    if (m) {
      const key = `${s.course_id}||${s.session_date}||${m[1]}`;
      sessionMap.set(key, s.id);
    }
  }

  // Build insert list for sessions not yet in DB
  const toInsert = [];
  for (const [key, col] of unique) {
    if (!sessionMap.has(key)) {
      const id = uuidv4();
      sessionMap.set(key, id);
      const t = SESSION_TIMES[col.sessionLabel] || DEFAULT_TIMES;
      toInsert.push({
        id,
        course_id:    col.courseId,
        session_date: col.date,
        start_time:   t.start,
        end_time:     t.end,
        status:       'completed',
        title:        `${col.courseName} ${col.date} ${col.sessionLabel}`,
        created_at:   new Date().toISOString(),
      });
    }
  }

  console.log(`   ${existing.length} already in DB, ${toInsert.length} new to insert`);

  const BATCH = 100;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const { error } = await supabase.from('sessions').insert(toInsert.slice(i, i + BATCH));
    if (error) throw new Error('sessions insert: ' + error.message);
    process.stdout.write(`\r   Sessions inserted: ${Math.min(i + BATCH, toInsert.length)}/${toInsert.length}`);
  }
  if (toInsert.length > 0) console.log();

  return sessionMap; // Map<key → sessionId>
}

// ─── PHASE 5: Build raw attendance records ───────────────────

function buildRawRecords(data, columns, sessionMap, studentMap) {
  const rawRecords   = [];
  const unmatchedStu = new Set();

  // Collect student rows (rows 5+, stop when Sno is blank/non-numeric)
  const studentRows = [];
  for (let r = 5; r < data.length; r++) {
    const row = data[r] || [];
    const sno  = String(row[0] || '').trim();
    const name = String(row[1] || '').trim();
    if (!sno || !name || isNaN(parseInt(sno, 10))) break;
    studentRows.push({ sno, name, row });
  }

  for (const col of columns) {
    const key       = `${col.courseId}||${col.date}||${col.sessionLabel}`;
    const sessionId = sessionMap.get(key);
    if (!sessionId) continue;

    for (const { sno, name, row } of studentRows) {
      const rawCode = String(row[col.colIndex] || '').trim();
      const status  = mapStatus(rawCode);

      dbg(`Processing: ${name} | ${col.date} | ${col.courseName} | ${col.sessionLabel} | raw="${rawCode}" → ${status || 'skip'}`);

      if (!status) continue;

      const student = resolveStudent(name, sno, studentMap);
      if (!student) { unmatchedStu.add(name); continue; }

      rawRecords.push({
        studentId: student.id,
        sessionId,
        courseId:  col.courseId,
        status,
        isoWeek:   col.isoWeek,
        date:      col.date,
        _name:     name,   // debug only
        _session:  `${col.courseName} ${col.date} ${col.sessionLabel}`,
      });
    }
  }
  return { rawRecords, unmatchedStu };
}

// ─── PHASE 6: Apply weekly C-limit rule ──────────────────────
// Max 2 'other' (C) per ISO week per student; extras → 'absent'

function applyWeeklyCLimit(records) {
  // Group 'other' records by (studentId, isoWeek)
  const groups = {};
  for (const rec of records) {
    if (rec.status !== 'other') continue;
    const key = `${rec.studentId}||${rec.isoWeek}`;
    (groups[key] = groups[key] || []).push(rec);
  }

  let overridden = 0;
  for (const group of Object.values(groups)) {
    group.sort((a, b) => a.date.localeCompare(b.date)); // chronological
    for (let i = 2; i < group.length; i++) {
      dbg(`C-limit: ${group[i]._name} | week ${group[i].isoWeek} | ${group[i]._session} [C#${i+1}→absent]`);
      group[i].status = 'absent';
      overridden++;
    }
  }
  console.log(`   Weekly C-limit: ${overridden} 'other' records converted to 'absent'`);
}

// ─── PHASE 7: Bulk upsert attendance_records ─────────────────

async function upsertAttendanceRecords(records) {
  const rows = records.map(r => ({
    id:            uuidv4(),
    session_id:    r.sessionId,
    student_id:    r.studentId,
    status:        r.status,
    calculated_at: new Date().toISOString(),
  }));

  const BATCH = 200;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase
      .from('attendance_records')
      .upsert(rows.slice(i, i + BATCH), { onConflict: 'session_id,student_id' });
    if (error) throw new Error('attendance upsert: ' + error.message);
    process.stdout.write(`\r   Attendance records: ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }
  console.log();
}

// ─── PHASE 8: Compute + upsert student_course_attendance ─────

function computeAttendancePct(records) {
  const stats = {}; // `${studentId}||${courseId}` → { num, den, ... }

  for (const r of records) {
    const key = `${r.studentId}||${r.courseId}`;
    if (!stats[key]) stats[key] = { num: 0, den: 0, studentId: r.studentId, courseId: r.courseId };
    const s = r.status;
    if      (s === 'present' || s === 'present_online') { stats[key].num += 1;   stats[key].den += 1; }
    else if (s === 'half')                               { stats[key].num += 0.5; stats[key].den += 1; }
    else if (s === 'absent')                             {                        stats[key].den += 1; }
    // 'leave' and 'other' (within C-limit) → excluded from both
  }

  return Object.values(stats).map(({ studentId, courseId, num, den }) => ({
    student_id:            studentId,
    course_id:             courseId,
    attendance_percentage: den > 0 ? parseFloat(((num / den) * 100).toFixed(4)) : 0,
    updated_at:            new Date().toISOString(),
  }));
}

async function upsertCourseAttendance(rows) {
  const BATCH = 200;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase
      .from('student_course_attendance')
      .upsert(rows.slice(i, i + BATCH), { onConflict: 'student_id,course_id' });
    if (error) throw new Error('student_course_attendance upsert: ' + error.message);
    process.stdout.write(`\r   Course attendance rows: ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }
  console.log();
}

// ─── MAIN ─────────────────────────────────────────────────────

async function main() {
  console.log('🚀 CIPD ERP — Attendance Ingestion');
  console.log('====================================');
  if (DEBUG) console.log('🐛 Debug mode ON\n');

  // ── Read workbook ─────────────────────────────────────────
  console.log(`\n📂 Reading: ${path.basename(XLSX_PATH)}`);
  const wb = XLSX.readFile(XLSX_PATH, { cellDates: false, sheetStubs: true });
  console.log(`   Sheets: ${wb.SheetNames.join(', ')}`);

  // ── Fetch student map from DB ─────────────────────────────
  console.log('\n👥 Fetching students from DB...');
  const studentMap = await fetchStudentMap();
  console.log(`   ${Object.keys(studentMap.byName).length} students loaded`);

  // ── PASS 1: Parse every sheet → collect columns ───────────
  const sheetParsed       = []; // { sheetName, data, columns }
  const allColumns        = [];
  const allUnmatchedCourses = new Set();

  for (const sheetName of wb.SheetNames) {
    console.log(`\n📋 Parsing sheet: "${sheetName}"`);
    const ws   = wb.Sheets[sheetName];
    const data = expandMerges(ws);
    const { columns, unmatchedCourses } = buildColumnMap(data);
    unmatchedCourses.forEach(c => allUnmatchedCourses.add(c));
    console.log(`   ${columns.length} session columns found`);
    sheetParsed.push({ sheetName, data, columns });
    allColumns.push(...columns);
  }

  // ── PASS 2: Upsert sessions ───────────────────────────────
  console.log('\n📅 Upserting sessions...');
  const sessionMap = await upsertSessions(allColumns);
  console.log(`   Total unique sessions tracked: ${sessionMap.size}`);

  // ── PASS 3: Build raw attendance records ──────────────────
  console.log('\n🔎 Building attendance records...');
  const allRawRecords     = [];
  const allUnmatchedStudents = new Set();

  for (const { sheetName, data, columns } of sheetParsed) {
    console.log(`   Sheet: ${sheetName}`);
    const { rawRecords, unmatchedStu } = buildRawRecords(data, columns, sessionMap, studentMap);
    unmatchedStu.forEach(s => allUnmatchedStudents.add(s));
    allRawRecords.push(...rawRecords);
    console.log(`   → ${rawRecords.length} records`);
  }

  // ── Apply C-limit rule ────────────────────────────────────
  console.log('\n⚖️  Applying weekly C-limit...');
  applyWeeklyCLimit(allRawRecords);

  // ── Upsert attendance_records ─────────────────────────────
  console.log('\n📝 Upserting attendance_records...');
  await upsertAttendanceRecords(allRawRecords);

  // ── Compute + upsert attendance % ─────────────────────────
  console.log('\n📊 Computing course-wise attendance %...');
  const pctRows = computeAttendancePct(allRawRecords);
  await upsertCourseAttendance(pctRows);

  // ── Summary ───────────────────────────────────────────────
  console.log('\n====================================');
  console.log('✅ INGESTION COMPLETE');
  console.log('====================================');
  console.log(`📅 Unique sessions:               ${sessionMap.size}`);
  console.log(`📝 Attendance records processed:  ${allRawRecords.length}`);
  console.log(`📊 Course attendance rows:         ${pctRows.length}`);

  if (allUnmatchedCourses.size > 0) {
    console.warn(`\n⚠️  Unmatched course names (${allUnmatchedCourses.size}):`);
    allUnmatchedCourses.forEach(c => console.warn(`   - "${c}"`));
  } else {
    console.log('✅ All course names matched');
  }

  if (allUnmatchedStudents.size > 0) {
    console.warn(`\n⚠️  Unmatched students (${allUnmatchedStudents.size}):`);
    allUnmatchedStudents.forEach(s => console.warn(`   - "${s}"`));
  } else {
    console.log('✅ All students matched');
  }

  console.log('\n🔍 Validation SQL:');
  console.log("   SELECT c.name, COUNT(*) sessions FROM sessions s JOIN courses c ON s.course_id=c.id GROUP BY c.name;");
  console.log("   SELECT status, COUNT(*) FROM attendance_records GROUP BY status;");
}

main().catch(err => {
  console.error('\n💥 Fatal error:', err.message);
  if (DEBUG) console.error(err.stack);
  process.exit(1);
});
