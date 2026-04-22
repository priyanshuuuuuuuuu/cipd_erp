/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  CiPD ERP — iPD CP Review Sheet Excel Import                        ║
 * ║  Reads "Data/Copy of iPD CP Review Sheet.xlsx" and populates:       ║
 * ║    • courses (domains)           • session_types                     ║
 * ║    • users + faculty (29 real)   • sessions (up to 20 Apr 2026)     ║
 * ║    • skills + session_skills                                         ║
 * ║                                                                      ║
 * ║  Usage (from repo root):                                             ║
 * ║    cd client-next                                                    ║
 * ║    node scripts/import_excel_data.mjs                                ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

import { createClient } from '@supabase/supabase-js';
import xlsx from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Supabase ──────────────────────────────────────────────────────────────────
const SUPABASE_URL         = 'https://pvqxzbabstyhskhydbvl.supabase.co';
const SUPABASE_SERVICE_KEY = '[REMOVED-ROTATED]';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Logging ───────────────────────────────────────────────────────────────────
const log  = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => console.log(`  ⚠ ${msg}`);
const err  = (msg, e) => console.error(`  ✗ ${msg}: ${e?.message || e}`);
const step = (msg) => console.log(`\n▶ ${msg}`);

// ── Excel file path (relative to repo root when run from client-next/) ────────
const EXCEL_PATH = path.resolve(__dirname, '../../Data/Copy of iPD CP Review Sheet.xlsx');

// ── Import filters ────────────────────────────────────────────────────────────
const CUTOFF_DATE = '2026-04-20'; // Only import sessions on or before this date

// ── Experience bucket normalisation ──────────────────────────────────────────
function parseExp(expStr) {
  if (!expStr) return null;
  const s = String(expStr).trim().toLowerCase();
  if (s === 'self') return 0;
  if (s === '#n/a' || s === 'na' || s === '') return null;
  const n = parseFloat(s.replace(/[^0-9.]/g, ''));
  return isNaN(n) ? null : Math.round(n);
}

// ── Slot → time mapping (4 slots per day) ────────────────────────────────────
const SLOT_TIMES = {
  'Slot 1': { start: '09:00', end: '10:30' },
  'Slot 2': { start: '10:45', end: '12:15' },
  'Slot 3': { start: '13:30', end: '15:00' },
  'Slot 4': { start: '15:15', end: '16:45' },
};
function getSlotTimes(slot, durationMins) {
  const base = SLOT_TIMES[slot?.trim()] || { start: '09:00', end: '10:30' };
  if (!durationMins || isNaN(durationMins)) return base;
  // Calculate end time from start + duration
  const [sh, sm] = base.start.split(':').map(Number);
  const totalMins = sh * 60 + sm + Math.round(Number(durationMins));
  const eh = Math.floor(totalMins / 60) % 24;
  const em = totalMins % 60;
  return {
    start: base.start,
    end: `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`,
  };
}

// ── UUID helper ───────────────────────────────────────────────────────────────
const uuid = () => crypto.randomUUID();

// ════════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  CiPD ERP — iPD CP Review Sheet Import');
  console.log('═══════════════════════════════════════════════════\n');

  // ── Read Excel ──────────────────────────────────────────────────────────────
  step('Reading Excel file...');
  let wb;
  try {
    wb = xlsx.readFile(EXCEL_PATH);
    log(`Opened: ${EXCEL_PATH}`);
  } catch (e) {
    return err('Cannot open Excel file', e);
  }

  // ── Parse MAIN sheet ────────────────────────────────────────────────────────
  const mainSheet  = wb.Sheets['main'];
  const mainData   = xlsx.utils.sheet_to_json(mainSheet, { defval: '' });
  log(`main sheet: ${mainData.length} rows`);

  // ── Parse INSTRUCTORS sheet ──────────────────────────────────────────────────
  const instrSheet = wb.Sheets['Instructors'];
  const instrData  = xlsx.utils.sheet_to_json(instrSheet, { defval: '' });
  log(`Instructors sheet: ${instrData.length} rows`);

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 1 — Collect unique domains → courses
  // ════════════════════════════════════════════════════════════════════════════
  step('Step 1 — Courses (domains)...');
  const DOMAINS = [
    'Business & Leadership',
    'Capstone',
    'Design & UI',
    'Electronics & Basics',
    'Embedded Systems & IOT',
    'Entrepreneurship',
    'Product Development',
    'Software & App Development',
  ];

  const courseRows = DOMAINS.map(name => ({
    id: uuid(),
    name,
    description: `${name} domain — iPD CP programme`,
  }));

  const { data: existingCourses, error: cErrQ } = await supabase
    .from('courses').select('id, name');
  if (cErrQ) return err('Fetch existing courses', cErrQ);

  const courseByName = {};
  for (const c of (existingCourses || [])) courseByName[c.name] = c;

  // Insert only courses that don't exist yet
  const newCourses = courseRows.filter(c => !courseByName[c.name]);
  if (newCourses.length > 0) {
    const { error: cErr } = await supabase.from('courses').insert(newCourses);
    if (cErr) return err('Insert courses', cErr);
    log(`Inserted ${newCourses.length} new courses`);
    for (const c of newCourses) courseByName[c.name] = c;
  } else {
    log('All courses already exist — skipped');
  }

  // Re-fetch to get accurate IDs (in case some were pre-existing)
  const { data: allCourses } = await supabase.from('courses').select('id, name');
  for (const c of (allCourses || [])) courseByName[c.name] = c;
  log(`Course map ready — ${Object.keys(courseByName).length} courses`);

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 2 — Session types
  // ════════════════════════════════════════════════════════════════════════════
  step('Step 2 — Session types...');
  const SESSION_TYPES = [
    'Capstone', 'Holiday', 'Industry Visit', 'Lab',
    'Lecture', 'Self Work', 'Tool Training', 'Workshop',
  ];

  // Try to query session_types table — it may not exist
  const { data: existingTypes, error: stErr } = await supabase
    .from('session_types').select('id, name');

  if (stErr) {
    warn(`session_types table may not exist: ${stErr.message}`);
    warn('Sessions will be imported without session_type_id — type stored in title.');
  }

  const typeByName = {};
  for (const t of (existingTypes || [])) typeByName[t.name] = t;

  const newTypes = SESSION_TYPES
    .filter(name => !typeByName[name])
    .map(name => ({ id: uuid(), name }));

  if (newTypes.length > 0 && !stErr) {
    const { error: tInsErr } = await supabase.from('session_types').insert(newTypes);
    if (tInsErr) warn(`Could not insert session types: ${tInsErr.message}`);
    else {
      log(`Inserted ${newTypes.length} session types`);
      for (const t of newTypes) typeByName[t.name] = t;
    }
  } else if (!stErr) {
    log('All session types already exist — skipped');
  }

  // Re-fetch
  if (!stErr) {
    const { data: allTypes } = await supabase.from('session_types').select('id, name');
    for (const t of (allTypes || [])) typeByName[t.name] = t;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 3 — Users + Faculty (from Instructors sheet)
  // ════════════════════════════════════════════════════════════════════════════
  step('Step 3 — Users + Faculty (29 instructors from Instructors sheet)...');

  const facultyPwd = await bcrypt.hash('faculty123', 12);

  // Build instructor list from the Instructors sheet
  const instructorList = instrData
    .filter(row => row['Name'] && String(row['Name']).trim() !== '')
    .map(row => {
      const name      = String(row['Name']).trim();
      const expYears  = row['Years of Experience'];
      const expRange  = String(row['Experience Range'] || '').trim();
      const parsedExp = parseExp(expYears);

      // Split name into first/last
      const parts = name.split(' ');
      const firstName = parts[0];
      const lastName  = parts.slice(1).join(' ') || '';

      // Create a slug email
      const slug  = name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
      const email = `${slug}@cipd.edu`;

      return { name, firstName, lastName, email, expYears: parsedExp, expRange };
    });

  log(`Processing ${instructorList.length} instructors from sheet`);

  // Fetch existing users with faculty role
  const { data: existingUsers, error: uErrQ } = await supabase
    .from('users').select('id, email, first_name, last_name').eq('role', 'faculty');
  if (uErrQ) return err('Fetch existing users', uErrQ);

  const userByEmail = {};
  for (const u of (existingUsers || [])) userByEmail[u.email] = u;

  const facultyByName = {};  // name → { id (user), facultyId }

  // Fetch existing faculty
  const { data: existingFaculty } = await supabase
    .from('faculty').select('id, years_experience');
  const existingFacultyIds = new Set((existingFaculty || []).map(f => f.id));

  for (const instr of instructorList) {
    // Skip "Holiday" — we don't create a user for it, sessions just get null faculty_id
    if (instr.name === 'Holiday') {
      facultyByName[instr.name] = null;
      continue;
    }

    let userId;

    if (userByEmail[instr.email]) {
      // Already exists
      userId = userByEmail[instr.email].id;
    } else {
      // Insert user
      const { data: newUser, error: uInsErr } = await supabase
        .from('users')
        .insert({
          id:            uuid(),
          email:         instr.email,
          password_hash: facultyPwd,
          role:          'faculty',
          first_name:    instr.firstName,
          last_name:     instr.lastName,
          is_active:     true,
        })
        .select('id')
        .single();
      if (uInsErr) { warn(`User insert failed for ${instr.name}: ${uInsErr.message}`); continue; }
      userId = newUser.id;
      log(`  Created user: ${instr.name} → ${instr.email}`);
    }

    // Ensure faculty record exists
    if (!existingFacultyIds.has(userId)) {
      const { error: fInsErr } = await supabase.from('faculty').insert({
        id:                        userId,
        years_experience:          instr.expYears,
        honorarium_rate_per_hour:  2000,
        designation:               'Instructor',
      });
      if (fInsErr) warn(`Faculty insert failed for ${instr.name}: ${fInsErr.message}`);
      existingFacultyIds.add(userId);
    }

    facultyByName[instr.name] = userId;
  }

  // Also build a map from the names that appear in main sheet (fallback matching)
  // Re-fetch all faculty+users to build a complete name→ID map
  const { data: allFacUsers } = await supabase
    .from('users')
    .select('id, first_name, last_name')
    .eq('role', 'faculty');

  for (const u of (allFacUsers || [])) {
    const fullName = `${u.first_name} ${u.last_name}`.trim();
    facultyByName[fullName] = u.id;
  }

  log(`Faculty map ready — ${Object.keys(facultyByName).length} entries`);

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 4 — Delete old fake sessions (from seed.mjs)
  // ════════════════════════════════════════════════════════════════════════════
  step('Step 4 — Removing old fake sessions...');

  // Delete dependent records first (in FK-safe order)
  // session_skills may use composite PK (session_id, skill_id) — delete all rows
  const { error: ssDelErr } = await supabase
    .from('session_skills').delete().not('session_id', 'is', null);
  if (ssDelErr) warn(`session_skills delete: ${ssDelErr.message}`);

  const { error: frDelErr } = await supabase
    .from('feedback_responses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (frDelErr) warn(`feedback_responses delete: ${frDelErr.message}`);

  const { error: arDelErr } = await supabase
    .from('attendance_records').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (arDelErr) warn(`attendance_records delete: ${arDelErr.message}`);

  const { error: aplDelErr } = await supabase
    .from('attendance_ping_logs').delete().neq('id', -1);
  if (aplDelErr) warn(`attendance_ping_logs delete: ${aplDelErr.message}`);

  const { error: smDelErr } = await supabase
    .from('session_materials').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (smDelErr) warn(`session_materials delete: ${smDelErr.message}`);

  // Notifications reference sessions — delete them too
  const { error: notifDelErr } = await supabase
    .from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (notifDelErr) warn(`notifications delete: ${notifDelErr.message}`);

  const { error: sesDelErr } = await supabase
    .from('sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (sesDelErr) return err('Delete old sessions', sesDelErr);

  log('Old sessions and dependent records cleared');

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 5 — Import sessions from Excel main sheet
  // ════════════════════════════════════════════════════════════════════════════
  step('Step 5 — Importing sessions from Excel (up to 20 Apr 2026, no Holidays)...');

  // Find admin user for created_by
  const { data: adminUser } = await supabase
    .from('users').select('id').eq('role', 'admin').limit(1).single();
  const adminId = adminUser?.id || null;

  const sessionRows = [];
  const skillsToProcess = []; // { sessionId, skills: string[] }

  for (const row of mainData) {
    // Parse date
    const rawDate = row['Date'];
    let sessionDate = null;
    if (rawDate) {
      // xlsx can return dates as JS Date objects or serial numbers or strings
      if (typeof rawDate === 'number') {
        // Excel serial date
        const d = xlsx.SSF.parse_date_code(rawDate);
        sessionDate = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
      } else if (rawDate instanceof Date) {
        sessionDate = rawDate.toISOString().split('T')[0];
      } else {
        const parsed = new Date(rawDate);
        if (!isNaN(parsed)) sessionDate = parsed.toISOString().split('T')[0];
        else sessionDate = String(rawDate).slice(0, 10);
      }
    }
    if (!sessionDate || sessionDate < '2020-01-01') continue; // skip if date is garbage

    // ── FILTER 1: Skip anything after April 20, 2026 ──────────────────────────
    if (sessionDate > CUTOFF_DATE) continue;

    const instructor  = String(row['Instructor'] || '').trim();
    const domain      = String(row['Domain'] || '').trim();
    const topic       = String(row['Topic / Module'] || '').trim();
    const slot        = String(row['Slot'] || '').trim();
    const durationRaw = row['Duration'];
    const duration    = durationRaw && !isNaN(Number(durationRaw)) ? Number(durationRaw) : 90;
    const typeRaw     = String(row['Type'] || '').trim();
    const expRaw      = String(row['Instructor Experience'] || '').trim();

    // ── FILTER 2: Skip Holiday sessions entirely ──────────────────────────────
    if (instructor === 'Holiday' || typeRaw === 'Holiday') continue;

    // All imported sessions are historical — mark as completed
    const status = 'completed';

    // Faculty ID lookup
    let facultyId = null;
    if (instructor && instructor !== 'Holiday' && instructor !== '') {
      facultyId = facultyByName[instructor] || null;
      if (!facultyId) {
        // Fuzzy match: try first name
        const firstName = instructor.split(' ')[0];
        for (const [n, id] of Object.entries(facultyByName)) {
          if (id && n.startsWith(firstName)) { facultyId = id; break; }
        }
      }
    }

    // Course ID lookup (domain)
    const courseId = domain ? (courseByName[domain]?.id || null) : null;

    // Session type ID
    const sessionTypeId = typeRaw ? (typeByName[typeRaw]?.id || null) : null;

    // Build title
    const title = topic || `${domain || instructor || 'Session'} — ${sessionDate}`;

    // Time calculation
    const { start, end } = getSlotTimes(slot, duration);

    const sessionId = uuid();

    sessionRows.push({
      id:               sessionId,
      title:            title.slice(0, 500),
      session_date:     sessionDate,
      start_time:       start,
      end_time:         end,
      status,
      faculty_id:       facultyId,
      course_id:        courseId,
      ...(sessionTypeId ? { session_type_id: sessionTypeId } : {}),
      created_by:       adminId,
    });

    // Collect skills for this session (Skill 1–4)
    const rowSkills = [
      row['Skill 1'], row['Skill 2'], row['Skill 3'], row['Skill 4'],
    ]
      .map(s => String(s || '').trim())
      .filter(s => s !== '' && s.toLowerCase() !== 'na');

    if (rowSkills.length > 0) {
      skillsToProcess.push({ sessionId, skills: rowSkills, domain });
    }
  }

  log(`Built ${sessionRows.length} session records to insert`);

  // Insert sessions in batches of 100
  let inserted = 0;
  for (let i = 0; i < sessionRows.length; i += 100) {
    const batch = sessionRows.slice(i, i + 100);
    const { error: sInsErr } = await supabase.from('sessions').insert(batch);
    if (sInsErr) {
      warn(`Session batch ${i}–${i+batch.length}: ${sInsErr.message}`);
      // Try one by one to isolate failures
      for (const s of batch) {
        const { error: singleErr } = await supabase.from('sessions').insert(s);
        if (singleErr) warn(`  Skip session ${s.id} (${s.session_date}): ${singleErr.message}`);
        else inserted++;
      }
    } else {
      inserted += batch.length;
    }
  }
  log(`Inserted ${inserted} sessions`);

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 6 — Skills + session_skills
  // ════════════════════════════════════════════════════════════════════════════
  step('Step 6 — Skills and session_skills mappings...');

  // 6a. Collect all unique skill names
  const allSkillNames = new Set();
  for (const { skills } of skillsToProcess) {
    for (const s of skills) allSkillNames.add(s);
  }
  log(`Unique skill names found: ${allSkillNames.size}`);

  // 6b. Fetch existing skills
  const { data: existingSkills } = await supabase
    .from('skills').select('id, name');
  const skillByName = {};
  for (const sk of (existingSkills || [])) skillByName[sk.name] = sk;

  // 6c. Insert new skills (no category_id — that requires a matching categories entry)
  const newSkills = [...allSkillNames]
    .filter(name => !skillByName[name])
    .map(name => ({ id: uuid(), name }));

  if (newSkills.length > 0) {
    for (let i = 0; i < newSkills.length; i += 100) {
      const { data: inserted, error: skInsErr } = await supabase
        .from('skills').insert(newSkills.slice(i, i+100)).select('id, name');
      if (skInsErr) warn(`Skills batch insert: ${skInsErr.message}`);
      else for (const sk of (inserted || [])) skillByName[sk.name] = sk;
    }
    log(`Inserted ${newSkills.length} new skills`);
  } else {
    log('All skills already exist — skipped');
  }

  // Re-fetch skills to ensure complete map
  const { data: allSkillsFinal } = await supabase.from('skills').select('id, name');
  for (const sk of (allSkillsFinal || [])) skillByName[sk.name] = sk;

  // 6d. Build session_skills rows
  const sessionSkillRows = [];
  const seen = new Set();
  for (const { sessionId, skills } of skillsToProcess) {
    for (const skillName of skills) {
      const sk = skillByName[skillName];
      if (!sk) continue;
      const key = `${sessionId}::${sk.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      sessionSkillRows.push({ session_id: sessionId, skill_id: sk.id });
    }
  }

  log(`Building ${sessionSkillRows.length} session_skills entries...`);

  let ssInserted = 0;
  for (let i = 0; i < sessionSkillRows.length; i += 200) {
    const { error: ssInsErr } = await supabase
      .from('session_skills').insert(sessionSkillRows.slice(i, i+200));
    if (ssInsErr) warn(`session_skills batch ${i}: ${ssInsErr.message}`);
    else ssInserted += Math.min(200, sessionSkillRows.length - i);
  }
  log(`Inserted ${ssInserted} session_skills`);

  // ════════════════════════════════════════════════════════════════════════════
  // DONE — Summary
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  ✅ Import Complete!');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Courses:        ${Object.keys(courseByName).length}`);
  console.log(`  Faculty:        ${Object.keys(facultyByName).filter(k => facultyByName[k]).length}`);
  console.log(`  Sessions:       ${inserted} (from ${sessionRows.length} parsed)`);
  console.log(`  Skills:         ${Object.keys(skillByName).length}`);
  console.log(`  Session-Skills: ${ssInserted}`);
  console.log('\n  → Visit /admin/reports to see the updated Master Report');
  console.log('═══════════════════════════════════════════════════\n');
}

main().catch(e => { console.error('\n✗ Fatal error:', e); process.exit(1); });
