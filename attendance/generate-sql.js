// ============================================================
// CIPD ERP — SQL Generator Script
// Generates a ready-to-run SQL file instead of calling Supabase directly.
// This COMPLETELY bypasses all network/fetch issues.
//
// Usage:  node generate-sql.js
// Then:   Copy the output seed.sql and paste it in Supabase SQL Editor
// Requires: npm install bcryptjs csv-parse uuid
// ============================================================

const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { v4: uuidv4 } = require('uuid');

// ─── CONFIG ──────────────────────────────────────────────────
const COURSE_ID = uuidv4();
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
  console.log('🚀 Generating seed.sql...');
  const lines = [];

  lines.push('-- ============================================================');
  lines.push('-- CIPD ERP Seed SQL');
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push('-- Run this in: Supabase Dashboard → SQL Editor → New Query');
  lines.push('-- ============================================================');
  lines.push('');
  lines.push('BEGIN;');
  lines.push('');

  // ── Course ─────────────────────────────────────────────────
  lines.push('-- ── Course ──────────────────────────────────────────────────');
  lines.push(`INSERT INTO courses (id, name, description, created_at) VALUES`);
  lines.push(`  ('${COURSE_ID}', 'iPD-CP (Intelligent Product Design — Core Programme)', 'Core programme for iPD-CP batch 2026', NOW())`);
  lines.push(`ON CONFLICT (id) DO NOTHING;`);
  lines.push('');

  // ── Students ───────────────────────────────────────────────
  lines.push('-- ── Users & Students ────────────────────────────────────────');
  const passwordHash = await bcrypt.hash('12345678', 10);
  const firstRows = parseCsv(CSV_FILES[0]);
  const studentRows = firstRows.slice(4, 22);
  const studentMap = {};

  const userValues = [];
  const studentValues = [];
  const enrollmentValues = [];

  for (const row of studentRows) {
    const sno = (row[0] || '').trim();
    const fullName = (row[1] || '').trim();
    if (!sno || !fullName || isNaN(parseInt(sno))) continue;

    const nameParts = fullName.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '-';
    const email = `${firstName.toLowerCase()}.${lastName.replace(/\s+/g, '').toLowerCase()}@dummy.com`;
    const enrollmentNo = `iPDCP2026W${sno}`;
    const userId = uuidv4();

    studentMap[fullName] = { userId };

    userValues.push(
      `  ('${userId}', '${sq(email)}', '${sq(passwordHash)}', '${sq(firstName)}', '${sq(lastName)}', 'student', true, NOW(), NOW())`
    );
    studentValues.push(
      `  ('${userId}', '${sq(enrollmentNo)}', '00:00:00:00:00:00', false, 'iPD-CP', NOW())`
    );
    enrollmentValues.push(
      `  ('${uuidv4()}', '${COURSE_ID}', '${userId}', '2026-01-01')`
    );

    console.log(`  ✅ Prepared student: ${fullName} (${enrollmentNo})`);
  }

  lines.push(`INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at) VALUES`);
  lines.push(userValues.join(',\n'));
  lines.push(`ON CONFLICT (id) DO NOTHING;`);
  lines.push('');

  lines.push(`INSERT INTO students (id, enrollment_no, mac_address, mac_verified, program_name, created_at) VALUES`);
  lines.push(studentValues.join(',\n'));
  lines.push(`ON CONFLICT (id) DO NOTHING;`);
  lines.push('');

  lines.push(`INSERT INTO course_enrollments (id, course_id, student_id, enrolled_at) VALUES`);
  lines.push(enrollmentValues.join(',\n'));
  lines.push(`ON CONFLICT (course_id, student_id) DO NOTHING;`);
  lines.push('');

  // ── Sessions & Attendance ───────────────────────────────────
  let sessionCount = 0;
  let attendanceCount = 0;
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

        let userId = studentMap[fullName]?.userId;
        if (!userId) {
          const matchedKey = Object.keys(studentMap).find(
            k => k.startsWith(fullName) || fullName.startsWith(k)
          );
          userId = matchedKey ? studentMap[matchedKey].userId : null;
        }
        if (!userId) continue;

        const rawCode = (row[col.colIndex] || '').trim();
        const status = mapStatus(rawCode);
        if (!status) continue;

        attendanceInserts.push(
          `  ('${uuidv4()}', '${sessionId}', '${userId}', '${status}', NOW())`
        );
        attendanceCount++;
      }
    }
  }

  // Write sessions in batches of 100 to avoid SQL limits
  lines.push('-- ── Sessions ────────────────────────────────────────────────');
  const BATCH = 100;
  for (let i = 0; i < sessionInserts.length; i += BATCH) {
    const batch = sessionInserts.slice(i, i + BATCH);
    lines.push(`INSERT INTO sessions (id, course_id, session_date, start_time, end_time, status, title, created_at) VALUES`);
    lines.push(batch.join(',\n'));
    lines.push(`ON CONFLICT DO NOTHING;`);
    lines.push('');
  }

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
  lines.push(`-- Done! Course ID: ${COURSE_ID}`);

  fs.writeFileSync(OUTPUT_FILE, lines.join('\n'), 'utf-8');

  console.log('\n=====================================');
  console.log('✅ seed.sql generated successfully!');
  console.log(`📊 ${Object.keys(studentMap).length} students`);
  console.log(`📅 ${sessionCount} sessions`);
  console.log(`📋 ${attendanceCount} attendance records`);
  console.log(`📌 Course ID: ${COURSE_ID}`);
  console.log('\n👉 Next step:');
  console.log('   1. Open Supabase Dashboard → SQL Editor → New Query');
  console.log('   2. Open the file: seed.sql');
  console.log('   3. Paste its contents and click RUN');
}

main().catch(err => {
  console.error('💥 Error:', err.message);
  process.exit(1);
});
