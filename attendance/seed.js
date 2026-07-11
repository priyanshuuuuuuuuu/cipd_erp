// ============================================================
// CIPD ERP — Database Seed Script
// Seeds: users, students, sessions, attendance_records
// Usage: node seed.js
// Requires: npm install @supabase/supabase-js bcryptjs csv-parse uuid
// ============================================================

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { v4: uuidv4 } = require('uuid');

// ─── CONFIG — fill these in ───────────────────────────────────
const SUPABASE_URL = 'https://pvqxzbabstyhskhydbl.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// A single fixed course UUID for the iPD-CP course
const COURSE_ID = uuidv4(); // generated once per run; you can hardcode a UUID after first run

// A fixed venue UUID (dummy)
const VENUE_ID = uuidv4();

// Session time slots per session number
const SESSION_TIMES = {
  'Session 01': { start: '09:00:00', end: '10:30:00' },
  'Session 02': { start: '10:45:00', end: '12:15:00' },
  'Session 03': { start: '13:00:00', end: '14:30:00' },
};

const DEFAULT_TIMES = { start: '09:00:00', end: '10:30:00' };

// Paths to the 3 CSV files
const CSV_FILES = [
  path.join(__dirname, 'Attendance _ iPD-CP(Jan-Jun 2026) _CSV.csv'),
  path.join(__dirname, 'Attendance _ iPD-CP(Jan-Jun 2026) _CSV2.csv'),
  path.join(__dirname, 'Attendance _ iPD-CP(Jan-Jun 2026) _CSV3.csv'),
];
// ─────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Maps an attendance code from the CSV to a DB status enum value.
 * Returns null if the session should be skipped entirely.
 */
function mapStatus(code) {
  if (!code) return null;
  const c = code.trim().toUpperCase();
  if (c === 'P' || c === 'P(O)' || c === 'P (O)') return 'present';
  if (c === 'H') return 'partial';
  if (c === 'A' || c === 'L') return 'absent';
  // C, empty, "No Session", "Holi Holiday", etc. → skip
  return null;
}

/**
 * Parses a date string from the CSV header row.
 * Handles formats: DD-MM-YYYY, M-D-YYYY, MM-DD-YYYY ambiguous cases.
 * Returns a YYYY-MM-DD string, or null if unparseable.
 */
function parseDate(raw) {
  if (!raw || !raw.trim()) return null;
  const s = raw.trim();

  // Match DD-MM-YYYY or D-M-YYYY
  const m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) return null;

  let [, part1, part2, year] = m;
  part1 = parseInt(part1);
  part2 = parseInt(part2);

  // Heuristic: if part1 > 12, it's definitely the day
  let day, month;
  if (part1 > 12) {
    day = part1;
    month = part2;
  } else if (part2 > 12) {
    day = part2;
    month = part1;
  } else {
    // Both <= 12: assume DD-MM (European format used in the sheet)
    day = part1;
    month = part2;
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Parses a CSV file and returns a 2D array of rows (already accounting for
 * multi-line quoted fields). Stops including rows after the 18 student rows.
 */
function parseCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const rows = parse(content, {
    relax_column_count: true,
    skip_empty_lines: false,
  });
  return rows;
}

/**
 * From the date header row (index 1) and session label row (index 3),
 * builds an array of column descriptors:
 *   [{ colIndex, date: 'YYYY-MM-DD', session: 'Session 01' }, ...]
 * Only columns starting from index 2 are considered.
 */
function buildColumnMap(rows) {
  const dateRow = rows[1] || [];
  const sessionRow = rows[3] || [];

  const columns = [];
  let lastDate = null;

  for (let i = 2; i < Math.max(dateRow.length, sessionRow.length); i++) {
    const rawDate = (dateRow[i] || '').trim();
    if (rawDate) {
      const parsed = parseDate(rawDate);
      if (parsed) lastDate = parsed;
    }

    const sessionLabel = (sessionRow[i] || '').trim();
    // Only record columns that have a valid session label AND a known date
    if (lastDate && sessionLabel.startsWith('Session')) {
      columns.push({ colIndex: i, date: lastDate, session: sessionLabel });
    }
  }

  return columns;
}

// ─── Step 1: Create Student Accounts ─────────────────────────

async function createStudents(rows) {
  console.log('\n📚 Creating student accounts...');
  const passwordHash = await bcrypt.hash('12345678', 10);
  const studentMap = {}; // name -> { userId, studentId }

  // Student rows: index 4 to 21 (18 students)
  const studentRows = rows.slice(4, 22);

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

    // Insert into users
    const { error: userErr } = await supabase.from('users').insert({
      id: userId,
      email,
      password_hash: passwordHash,
      first_name: firstName,
      last_name: lastName,
      role: 'student',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (userErr) {
      console.error(`  ❌ Failed to insert user ${fullName}:`, userErr.message);
      continue;
    }

    // Insert into students
    const { error: stuErr } = await supabase.from('students').insert({
      id: userId,
      enrollment_no: enrollmentNo,
      mac_address: '00:00:00:00:00:00',
      mac_verified: false,
      program_name: 'iPD-CP',
      created_at: new Date().toISOString(),
    });

    if (stuErr) {
      console.error(`  ❌ Failed to insert student ${fullName}:`, stuErr.message);
      continue;
    }

    studentMap[fullName] = { userId, studentId: userId };
    console.log(`  ✅ Created: ${fullName} (${enrollmentNo}) → ${email}`);
  }

  return studentMap;
}

// ─── Step 2: Seed Course (once) ──────────────────────────────

async function seedCourse() {
  console.log('\n📖 Inserting dummy course...');
  const { error } = await supabase.from('courses').insert({
    id: COURSE_ID,
    name: 'iPD-CP (Intelligent Product Design — Core Programme)',
    description: 'Core programme for iPD-CP batch 2026',
    created_at: new Date().toISOString(),
  });
  if (error) {
    console.warn('  ⚠️  Course insert warning (may already exist):', error.message);
  } else {
    console.log(`  ✅ Course ID: ${COURSE_ID}`);
  }
}

// ─── Step 3: Process Each CSV File ───────────────────────────

async function processCsvFile(filePath, studentMap) {
  console.log(`\n📂 Processing: ${path.basename(filePath)}`);
  const rows = parseCsv(filePath);
  const columnMap = buildColumnMap(rows);

  console.log(`  Found ${columnMap.length} session columns`);

  // Build student rows: index 4 to 21
  const studentRows = rows.slice(4, 22);

  // For each column (= one session slot on a specific date)
  for (const col of columnMap) {
    const times = SESSION_TIMES[col.session] || DEFAULT_TIMES;

    // Create session record
    const sessionId = uuidv4();
    const sessionTitle = `iPD-CP ${col.date} ${col.session}`;

    const { error: sessErr } = await supabase.from('sessions').insert({
      id: sessionId,
      course_id: COURSE_ID,
      session_date: col.date,
      start_time: times.start,
      end_time: times.end,
      status: 'completed',
      title: sessionTitle,
      created_at: new Date().toISOString(),
    });

    if (sessErr) {
      // Skip duplicate sessions (same date+time) gracefully
      if (sessErr.message.includes('duplicate') || sessErr.message.includes('unique')) {
        continue;
      }
      console.error(`  ❌ Session insert failed for ${col.date} ${col.session}:`, sessErr.message);
      continue;
    }

    // For each student, insert attendance record
    const attendanceRecords = [];

    for (const row of studentRows) {
      const fullName = (row[1] || '').trim();
      if (!fullName) continue;

      const student = studentMap[fullName];
      if (!student) {
        // Try partial name match
        const matchedKey = Object.keys(studentMap).find(k => k.startsWith(fullName) || fullName.startsWith(k));
        if (!matchedKey) continue;
      }

      const studentId = (student || studentMap[Object.keys(studentMap).find(k => k.startsWith(fullName) || fullName.startsWith(k))])?.studentId;
      if (!studentId) continue;

      const rawCode = (row[col.colIndex] || '').trim();
      const status = mapStatus(rawCode);

      if (!status) continue; // Skip C, empty, "No Session", etc.

      attendanceRecords.push({
        id: uuidv4(),
        session_id: sessionId,
        student_id: studentId,
        status,
        calculated_at: new Date().toISOString(),
      });
    }

    if (attendanceRecords.length > 0) {
      const { error: attErr } = await supabase.from('attendance_records').insert(attendanceRecords);
      if (attErr) {
        console.error(`  ❌ Attendance insert failed for ${col.date} ${col.session}:`, attErr.message);
      } else {
        console.log(`  ✅ ${col.date} ${col.session}: ${attendanceRecords.length} records`);
      }
    }
  }
}

// ─── Step 4: Seed Enrollments ─────────────────────────────────

async function seedEnrollments(studentMap) {
  console.log('\n🔗 Creating course enrollments...');
  for (const [name, { studentId }] of Object.entries(studentMap)) {
    const { error } = await supabase.from('course_enrollments').insert({
      id: uuidv4(),
      course_id: COURSE_ID,
      student_id: studentId,
      enrolled_at: new Date('2026-01-01').toISOString(),
    });
    if (error) {
      console.warn(`  ⚠️  Enrollment warning for ${name}:`, error.message);
    } else {
      console.log(`  ✅ Enrolled: ${name}`);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────

async function main() {
  console.log('🚀 CIPD ERP Seed Script Starting...');
  console.log('=====================================');

  // Validate config
  if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_SERVICE_KEY === 'YOUR_SUPABASE_SERVICE_ROLE_KEY') {
    console.error('❌ Please fill in SUPABASE_URL and SUPABASE_SERVICE_KEY in seed.js before running!');
    process.exit(1);
  }

  // Read first CSV to get student names (all 3 have same 18 students)
  const firstRows = parseCsv(CSV_FILES[0]);

  // Step 1: Create students
  const studentMap = await createStudents(firstRows);
  console.log(`\n✅ Created ${Object.keys(studentMap).length} student accounts`);

  // Step 2: Seed the course
  await seedCourse();

  // Step 3: Seed enrollments
  await seedEnrollments(studentMap);

  // Step 4: Process each CSV
  for (const csvFile of CSV_FILES) {
    await processCsvFile(csvFile, studentMap);
  }

  console.log('\n=====================================');
  console.log('🎉 Seeding complete!');
  console.log(`📌 Course ID (save this): ${COURSE_ID}`);
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
