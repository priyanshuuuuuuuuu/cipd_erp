// ============================================================
// CIPD ERP — SQL Generator Script (Attendance Only)
// Generates sessions + attendance_records + course_enrollments.
// Students, users are assumed to ALREADY BE SEEDED in Supabase.
// Student IDs are looked up at SQL-time via enrollment_no.
//
// Usage:  node generate-sql.js
// Then:   Paste output seed.sql in Supabase SQL Editor → RUN
// Requires: npm install csv-parse uuid
// ============================================================

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { v4: uuidv4 } = require('uuid');

// ─── CONFIG ──────────────────────────────────────────────────
// ⚠️  IMPORTANT: Set this to the course ID that already exists in your DB.
//     Check your `courses` table in Supabase and paste the ID here.
//     e.g. '3f4a1b2c-...'
const COURSE_ID = process.env.COURSE_ID || 'YOUR_EXISTING_COURSE_ID_HERE';

const OUTPUT_FILE = path.join(__dirname, 'seed.sql');

const SESSION_TIMES = {
  'Session 01': { start: '09:00:00', end: '10:30:00' },
  'Session 02': { start: '10:45:00', end: '12:15:00' },
  'Session 03': { start: '13:00:00', end: '14:30:00' },
};
const DEFAULT_TIMES = { start: '09:00:00', end: '10:30:00' };

const CSV_FILES = [
  path.join(__dirname, 'Attendance _ iPD-CP(Jan-Jun 2026) _CSV.csv'),
  path.join(__dirname, 'Attendance _ iPD-CP(Jan-Jun 2026) _CSV2.csv'),
  path.join(__dirname, 'Attendance _ iPD-CP(Jan-Jun 2026) _CSV3.csv'),
];
// ─────────────────────────────────────────────────────────────

// Escape single quotes in SQL strings
function sq(str) {
  return String(str ?? '').replace(/'/g, "''");
}

function mapStatus(code) {
  if (!code) return null;
  const c = code.trim().toUpperCase();
  if (c === 'P' || c === 'P(O)' || c === 'P (O)') return 'present';
  if (c === 'H') return 'partial';
  if (c === 'A' || c === 'L') return 'absent';
  return null;
}

function parseDate(raw) {
  if (!raw || !raw.trim()) return null;
  const s = raw.trim();
  const m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) return null;
  let [, part1, part2, year] = m;
  part1 = parseInt(part1); part2 = parseInt(part2);
  let day, month;
  if (part1 > 12) { day = part1; month = part2; }
  else if (part2 > 12) { day = part2; month = part1; }
  else { day = part1; month = part2; }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return parse(content, { relax_column_count: true, skip_empty_lines: false });
}

function buildColumnMap(rows) {
  const dateRow = rows[1] || [];
  const sessionRow = rows[3] || [];
  const columns = [];
  let lastDate = null;
  for (let i = 2; i < Math.max(dateRow.length, sessionRow.length); i++) {
    const rawDate = (dateRow[i] || '').trim();
    if (rawDate) { const p = parseDate(rawDate); if (p) lastDate = p; }
    const label = (sessionRow[i] || '').trim();
    if (lastDate && label.startsWith('Session')) {
      columns.push({ colIndex: i, date: lastDate, session: label });
    }
  }
  return columns;
}

async function main() {
  if (COURSE_ID === 'YOUR_EXISTING_COURSE_ID_HERE') {
    console.error('❌  Please set COURSE_ID at the top of this script (or via env var COURSE_ID).');
    console.error('    Check your Supabase `courses` table for the existing course UUID.');
    process.exit(1);
  }

  console.log('🚀 Generating seed.sql (attendance-only mode)...');
  const lines = [];

  lines.push('-- ============================================================');
  lines.push('-- CIPD ERP Seed SQL — Attendance Only');
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push('-- Students/Users are assumed to already exist in DB.');
  lines.push('-- Student IDs are resolved dynamically via enrollment_no.');
  lines.push('-- Run this in: Supabase Dashboard → SQL Editor → New Query');
  lines.push('-- ============================================================');
  lines.push('');
  lines.push('BEGIN;');
  lines.push('');

  // ── Build student map from the first CSV (enrollment_no → fullName) ──
  const firstRows = parseCsv(CSV_FILES[0]);
  const studentRows = firstRows.slice(4, 22);

  // Maps fullName → enrollmentNo so we can look up at SQL time
  // e.g. { 'Mayank Chauhan': 'iPDCP2026W10' }
  const studentMap = {}; // fullName → { enrollmentNo }

  for (const row of studentRows) {
    const sno = (row[0] || '').trim();
    const fullName = (row[1] || '').trim();
    if (!sno || !fullName || isNaN(parseInt(sno))) continue;
    const enrollmentNo = `iPDCP2026W${sno}`;
    studentMap[fullName] = { enrollmentNo };
    console.log(`  ✅ Mapped: ${fullName} → ${enrollmentNo}`);
  }

  // ── Course Enrollments ─────────────────────────────────────────────
  lines.push('-- ── Course Enrollments ─────────────────────────────────────');
  lines.push('-- Links each student to the course using enrollment_no subquery');
  for (const [fullName, { enrollmentNo }] of Object.entries(studentMap)) {
    const enrollId = uuidv4();
    const studentSubquery = `(SELECT id FROM students WHERE enrollment_no='${sq(enrollmentNo)}')`;
    lines.push(
      `INSERT INTO course_enrollments (id, course_id, student_id, enrolled_at)`
    );
    lines.push(
      `  VALUES ('${enrollId}', '${COURSE_ID}', ${studentSubquery}, '2026-01-01')`
    );
    lines.push(`  ON CONFLICT (course_id, student_id) DO NOTHING;`);
  }
  lines.push('');

  // ── Sessions & Attendance ───────────────────────────────────────────
  let sessionCount = 0;
  let attendanceCount = 0;
  let skippedCount = 0;
  const sessionInserts = [];
  const attendanceInserts = [];

  for (const csvFile of CSV_FILES) {
    console.log(`\n📂 Processing: ${path.basename(csvFile)}`);
    const rows = parseCsv(csvFile);
    const columnMap = buildColumnMap(rows);
    const csvStudentRows = rows.slice(4, 22);

    for (const col of columnMap) {
      const times = SESSION_TIMES[col.session] || DEFAULT_TIMES;
      const sessionId = uuidv4();
      const titleEsc = sq(`iPD-CP ${col.date} ${col.session}`);

      sessionInserts.push(
        `  ('${sessionId}', '${COURSE_ID}', '${col.date}', '${times.start}', '${times.end}', 'completed', '${titleEsc}', NOW())`
      );
      sessionCount++;

      for (const row of csvStudentRows) {
        const fullName = (row[1] || '').trim();
        if (!fullName) continue;

        // Lookup enrollment_no from our map (with fuzzy fallback)
        let enrollmentNo = studentMap[fullName]?.enrollmentNo;
        if (!enrollmentNo) {
          const matchedKey = Object.keys(studentMap).find(
            k => k.startsWith(fullName) || fullName.startsWith(k)
          );
          enrollmentNo = matchedKey ? studentMap[matchedKey].enrollmentNo : null;
        }
        if (!enrollmentNo) {
          skippedCount++;
          continue;
        }

        const rawCode = (row[col.colIndex] || '').trim();
        const status = mapStatus(rawCode);
        if (!status) continue;

        // Use a SQL subquery to resolve the student UUID at DB execution time
        const studentSubquery = `(SELECT id FROM students WHERE enrollment_no='${sq(enrollmentNo)}')`;

        attendanceInserts.push(
          `  ('${uuidv4()}', '${sessionId}', ${studentSubquery}, '${status}', NOW())`
        );
        attendanceCount++;
      }
    }
  }

  // ── Write Sessions in batches of 100 ─────────────────────────────
  lines.push('-- ── Sessions ────────────────────────────────────────────────');
  const BATCH = 100;
  for (let i = 0; i < sessionInserts.length; i += BATCH) {
    const batch = sessionInserts.slice(i, i + BATCH);
    lines.push(`INSERT INTO sessions (id, course_id, session_date, start_time, end_time, status, title, created_at) VALUES`);
    lines.push(batch.join(',\n'));
    lines.push(`ON CONFLICT DO NOTHING;`);
    lines.push('');
  }

  // ── Write Attendance Records in batches of 100 ───────────────────
  lines.push('-- ── Attendance Records ──────────────────────────────────────');
  for (let i = 0; i < attendanceInserts.length; i += BATCH) {
    const batch = attendanceInserts.slice(i, i + BATCH);
    lines.push(`INSERT INTO attendance_records (id, session_id, student_id, status, calculated_at) VALUES`);
    lines.push(batch.join(',\n'));
    lines.push(`ON CONFLICT (session_id, student_id) DO NOTHING;`);
    lines.push('');
  }

  lines.push('COMMIT;');
  lines.push('');
  lines.push(`-- Done! Course ID used: ${COURSE_ID}`);
  lines.push(`-- Sessions generated: ${sessionCount}`);
  lines.push(`-- Attendance records generated: ${attendanceCount}`);
  lines.push(`-- Students skipped (name mismatch): ${skippedCount}`);

  fs.writeFileSync(OUTPUT_FILE, lines.join('\n'), 'utf-8');

  console.log('\n=====================================');
  console.log('✅ seed.sql generated successfully!');
  console.log(`📊 ${Object.keys(studentMap).length} students mapped`);
  console.log(`📅 ${sessionCount} sessions`);
  console.log(`📋 ${attendanceCount} attendance records`);
  if (skippedCount > 0) {
    console.log(`⚠️  ${skippedCount} attendance rows skipped (name mismatch — check CSV names vs DB)`);
  }
  console.log(`📌 Course ID used: ${COURSE_ID}`);
  console.log('\n👉 Next step:');
  console.log('   1. Open Supabase Dashboard → SQL Editor → New Query');
  console.log('   2. Open the file: seed.sql');
  console.log('   3. Paste its contents and click RUN');
}

main().catch(err => {
  console.error('💥 Error:', err.message);
  process.exit(1);
});
