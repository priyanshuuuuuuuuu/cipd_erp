/**
 * CiPD ERP - iPD CP Review Sheet Excel Import
 *
 * SAFE TO RE-RUN ANYTIME:
 *   - Never deletes attendance, feedback, notifications, or student data
 *   - Removes Holiday sessions from DB (if any exist from old imports)
 *   - Upserts sessions: updates existing ones, inserts new ones
 *   - Only imports sessions up to CUTOFF_DATE
 *
 * Usage (from repo root):
 *   cd client-next
 *   node scripts/import_excel_data.mjs
 */

import { createClient } from '@supabase/supabase-js';
import xlsx from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Supabase connection
const SUPABASE_URL         = 'https://pvqxzbabstyhskhydbvl.supabase.co';
const SUPABASE_SERVICE_KEY = '[REMOVED-ROTATED]';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Logging helpers
const log  = (msg) => console.log('  OK ' + msg);
const warn = (msg) => console.log('  WARN ' + msg);
const step = (msg) => console.log('\n>> ' + msg);

// Excel file path
const EXCEL_PATH  = path.resolve(__dirname, '../../Data/iPD CP Review Sheet.xlsx');

// Only import sessions on or before this date (past historical data)
// Change this if you want to extend the cutoff date
const CUTOFF_DATE = '2026-05-03';

// Slot time mapping
const SLOT_TIMES = {
  'Slot 1': { start: '09:00', end: '10:30' },
  'Slot 2': { start: '10:45', end: '12:15' },
  'Slot 3': { start: '13:30', end: '15:00' },
  'Slot 4': { start: '15:15', end: '16:45' },
};

function getSlotTimes(slot, durationMins) {
  const base = SLOT_TIMES[slot?.trim()] || { start: '09:00', end: '10:30' };
  if (!durationMins || isNaN(durationMins)) return base;
  const [sh, sm] = base.start.split(':').map(Number);
  const totalMins = sh * 60 + sm + Math.round(Number(durationMins));
  const eh = Math.floor(totalMins / 60) % 24;
  const em = totalMins % 60;
  return {
    start: base.start,
    end: String(eh).padStart(2, '0') + ':' + String(em).padStart(2, '0'),
  };
}

function parseExp(expStr) {
  if (!expStr) return null;
  const s = String(expStr).trim().toLowerCase();
  if (s === 'self' || s === '#n/a' || s === 'na' || s === '') return null;
  const n = parseFloat(s.replace(/[^0-9.]/g, ''));
  return isNaN(n) ? null : Math.round(n);
}

const uuid = () => crypto.randomUUID();

// ============================================================================
async function main() {
  console.log('\n================================================');
  console.log('  CiPD ERP - iPD CP Review Sheet Import');
  console.log('  Mode: SAFE UPSERT (zero deletions of user data)');
  console.log('================================================\n');

  // --------------------------------------------------------------------------
  // Read Excel
  // --------------------------------------------------------------------------
  step('Reading Excel file...');
  let wb;
  try {
    wb = xlsx.readFile(EXCEL_PATH);
    log('Opened: ' + EXCEL_PATH);
  } catch (e) {
    console.error('Cannot open Excel file: ' + e.message);
    process.exit(1);
  }

  const mainData  = xlsx.utils.sheet_to_json(wb.Sheets['main'],        { defval: '' });
  const instrData = xlsx.utils.sheet_to_json(wb.Sheets['Instructors'], { defval: '' });
  log('main sheet: ' + mainData.length + ' rows');
  log('Instructors sheet: ' + instrData.length + ' rows');

  // --------------------------------------------------------------------------
  // STEP 1 - Courses (upsert by name)
  // --------------------------------------------------------------------------
  step('Step 1 - Courses (domains)...');
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

  const { data: existingCourses } = await supabase.from('courses').select('id, name');
  const courseByName = {};
  for (const c of (existingCourses || [])) courseByName[c.name] = c;

  const newCourses = DOMAINS
    .filter(name => !courseByName[name])
    .map(name => ({ id: uuid(), name, description: name + ' domain - iPD CP programme' }));

  if (newCourses.length > 0) {
    const { error: cErr } = await supabase.from('courses').insert(newCourses);
    if (cErr) { console.error('Insert courses: ' + cErr.message); process.exit(1); }
    for (const c of newCourses) courseByName[c.name] = c;
    log('Inserted ' + newCourses.length + ' new courses');
  } else {
    log('All courses already exist');
  }

  // Re-fetch to ensure complete map
  const { data: allCourses } = await supabase.from('courses').select('id, name');
  for (const c of (allCourses || [])) courseByName[c.name] = c;
  log('Course map ready: ' + Object.keys(courseByName).length + ' courses');

  // --------------------------------------------------------------------------
  // STEP 2 - Session types (upsert by name)
  // --------------------------------------------------------------------------
  step('Step 2 - Session types...');
  const SESSION_TYPES = [
    'Capstone', 'Holiday', 'Industry Visit', 'Lab',
    'Lecture', 'Self Work', 'Tool Training', 'Workshop',
  ];

  const { data: existingTypes, error: stErr } = await supabase
    .from('session_types').select('id, name');

  const typeByName = {};
  for (const t of (existingTypes || [])) typeByName[t.name] = t;

  if (!stErr) {
    const newTypes = SESSION_TYPES
      .filter(name => !typeByName[name])
      .map(name => ({ id: uuid(), name }));
    if (newTypes.length > 0) {
      const { error: tErr } = await supabase.from('session_types').insert(newTypes);
      if (!tErr) {
        for (const t of newTypes) typeByName[t.name] = t;
        log('Inserted ' + newTypes.length + ' new session types');
      } else {
        warn('Could not insert session types: ' + tErr.message);
      }
    } else {
      log('All session types already exist');
    }
    const { data: allTypes } = await supabase.from('session_types').select('id, name');
    for (const t of (allTypes || [])) typeByName[t.name] = t;
  } else {
    warn('session_types table issue: ' + stErr.message);
  }

  // --------------------------------------------------------------------------
  // STEP 3 - Users + Faculty (upsert by email)
  // --------------------------------------------------------------------------
  step('Step 3 - Users + Faculty...');

  const facultyPwd = await bcrypt.hash('faculty123', 12);

  const instructorList = instrData
    .filter(row => row['Name'] && String(row['Name']).trim() !== '')
    .map(row => {
      const name      = String(row['Name']).trim();
      const parts     = name.split(' ');
      const firstName = parts[0];
      const lastName  = parts.slice(1).join(' ') || '';
      const slug      = name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
      const email     = slug + '@cipd.edu';
      return { name, firstName, lastName, email, expYears: parseExp(row['Years of Experience']) };
    });

  log('Processing ' + instructorList.length + ' instructors');

  const { data: existingUsers } = await supabase
    .from('users').select('id, email').eq('role', 'faculty');
  const userByEmail = {};
  for (const u of (existingUsers || [])) userByEmail[u.email] = u;

  const { data: existingFaculty } = await supabase.from('faculty').select('id');
  const existingFacultyIds = new Set((existingFaculty || []).map(f => f.id));

  const facultyByName = {};

  for (const instr of instructorList) {
    if (instr.name === 'Holiday') { facultyByName['Holiday'] = null; continue; }

    let userId;
    if (userByEmail[instr.email]) {
      userId = userByEmail[instr.email].id;
    } else {
      const { data: newUser, error: uErr } = await supabase
        .from('users')
        .insert({
          id: uuid(), email: instr.email, password_hash: facultyPwd,
          role: 'faculty', first_name: instr.firstName, last_name: instr.lastName, is_active: true,
        })
        .select('id').single();
      if (uErr) { warn('User insert failed for ' + instr.name + ': ' + uErr.message); continue; }
      userId = newUser.id;
      log('Created user: ' + instr.name);
    }

    if (!existingFacultyIds.has(userId)) {
      const { error: fErr } = await supabase.from('faculty').insert({
        id: userId, years_experience: instr.expYears,
        honorarium_rate_per_hour: 2000, designation: 'Instructor',
      });
      if (fErr) warn('Faculty insert failed for ' + instr.name + ': ' + fErr.message);
      else existingFacultyIds.add(userId);
    }

    facultyByName[instr.name] = userId;
  }

  // Build complete name -> ID map from DB
  const { data: allFacUsers } = await supabase
    .from('users').select('id, first_name, last_name').eq('role', 'faculty');
  for (const u of (allFacUsers || [])) {
    facultyByName[(u.first_name + ' ' + u.last_name).trim()] = u.id;
  }
  log('Faculty map ready: ' + Object.keys(facultyByName).length + ' entries');

  // --------------------------------------------------------------------------
  // STEP 4 - Remove Holiday sessions from DB (clean up old imports)
  // --------------------------------------------------------------------------
  step('Step 4 - Removing Holiday sessions from DB...');

  // Find the Holiday session_type ID
  const holidayTypeId = typeByName['Holiday']?.id || null;
  let holidayDelCount = 0;

  if (holidayTypeId) {
    // First remove their session_skills links
    const { data: holidaySessions } = await supabase
      .from('sessions').select('id').eq('session_type_id', holidayTypeId);
    const holidayIds = (holidaySessions || []).map(s => s.id);

    if (holidayIds.length > 0) {
      // Delete session_skills for holiday sessions
      await supabase.from('session_skills').delete().in('session_id', holidayIds);
      // Delete the holiday sessions themselves
      const { error: hDelErr } = await supabase
        .from('sessions').delete().eq('session_type_id', holidayTypeId);
      if (hDelErr) warn('Holiday session delete: ' + hDelErr.message);
      else { holidayDelCount = holidayIds.length; log('Removed ' + holidayDelCount + ' Holiday sessions'); }
    } else {
      log('No Holiday sessions found in DB');
    }
  } else {
    // Also check by title pattern
    const { data: holidayByTitle } = await supabase
      .from('sessions').select('id').ilike('title', '%holiday%');
    if ((holidayByTitle || []).length > 0) {
      const ids = holidayByTitle.map(s => s.id);
      await supabase.from('session_skills').delete().in('session_id', ids);
      await supabase.from('sessions').delete().in('id', ids);
      log('Removed ' + ids.length + ' Holiday sessions (by title)');
    } else {
      log('No Holiday sessions found in DB');
    }
  }

  // NOTE: attendance_records, attendance_ping_logs, feedback_responses,
  //       notifications, and session_materials are NEVER touched by this script.

  // --------------------------------------------------------------------------
  // STEP 5 - Upsert sessions from Excel
  //   Natural key = session_date + start_time + course_id
  //   If session exists with this key -> UPDATE it
  //   If not -> INSERT new
  // --------------------------------------------------------------------------
  step('Step 5 - Upserting sessions (up to ' + CUTOFF_DATE + ', Holidays excluded)...');

  const { data: adminUser } = await supabase
    .from('users').select('id').eq('role', 'admin').limit(1).single();
  const adminId = adminUser?.id || null;

  // Load all existing sessions for matching
  const { data: existingSessions } = await supabase
    .from('sessions').select('id, session_date, start_time, course_id');

  const sessionByKey = {}; // "date::HH:MM::courseId" -> session id
  for (const s of (existingSessions || [])) {
    // DB stores start_time as "HH:MM:SS" - slice to "HH:MM" for comparison
    const startHHMM = (s.start_time || '').slice(0, 5);
    const key = s.session_date + '::' + startHHMM + '::' + s.course_id;
    sessionByKey[key] = s.id;
  }
  log('Existing sessions loaded: ' + Object.keys(sessionByKey).length);

  const toInsert = [];
  const toUpdate = [];
  const skillsToProcess = []; // { sessionId, skills[] }

  for (const row of mainData) {
    // Parse date
    const rawDate = row['Date'];
    let sessionDate = null;
    if (rawDate) {
      if (typeof rawDate === 'number') {
        const d = xlsx.SSF.parse_date_code(rawDate);
        sessionDate = d.y + '-' + String(d.m).padStart(2,'0') + '-' + String(d.d).padStart(2,'0');
      } else if (rawDate instanceof Date) {
        sessionDate = rawDate.toISOString().split('T')[0];
      } else {
        const parsed = new Date(rawDate);
        sessionDate = !isNaN(parsed) ? parsed.toISOString().split('T')[0] : String(rawDate).slice(0,10);
      }
    }
    if (!sessionDate || sessionDate < '2020-01-01') continue;

    // FILTER: Only up to cutoff date
    if (sessionDate > CUTOFF_DATE) continue;

    const instructor  = String(row['Instructor']    || '').trim();
    const domain      = String(row['Domain']        || '').trim();
    const topic       = String(row['Topic / Module']|| '').trim();
    const slot        = String(row['Slot']          || '').trim();
    const durationRaw = row['Duration'];
    const duration    = durationRaw && !isNaN(Number(durationRaw)) ? Number(durationRaw) : 90;
    const typeRaw     = String(row['Type']          || '').trim();

    // FILTER: Skip all Holiday rows
    if (instructor === 'Holiday' || typeRaw === 'Holiday') continue;

    // Faculty lookup
    let facultyId = null;
    if (instructor) {
      facultyId = facultyByName[instructor] || null;
      if (!facultyId) {
        const firstName = instructor.split(' ')[0];
        for (const [n, id] of Object.entries(facultyByName)) {
          if (id && n.startsWith(firstName)) { facultyId = id; break; }
        }
      }
    }

    const courseId      = domain ? (courseByName[domain]?.id || null) : null;
    const sessionTypeId = typeRaw ? (typeByName[typeRaw]?.id || null) : null;
    const title         = (topic || domain || instructor || 'Session') + (topic ? '' : ' - ' + sessionDate);
    const { start, end } = getSlotTimes(slot, duration);

    // Upsert key
    const naturalKey = sessionDate + '::' + start + '::' + courseId;
    const existingId = sessionByKey[naturalKey];

    const payload = {
      title:        title.slice(0, 500),
      session_date: sessionDate,
      start_time:   start,
      end_time:     end,
      status:       'completed',
      faculty_id:   facultyId,
      course_id:    courseId,
    };
    if (sessionTypeId) payload.session_type_id = sessionTypeId;

    let sessionId;
    if (existingId) {
      // Session already in DB - update it
      sessionId = existingId;
      toUpdate.push({ id: existingId, ...payload });
    } else {
      // New session - insert it
      sessionId = uuid();
      toInsert.push({ id: sessionId, ...payload, created_by: adminId });
      sessionByKey[naturalKey] = sessionId; // prevent duplicate within same Excel
    }

    // Collect skills
    const rowSkills = [row['Skill 1'], row['Skill 2'], row['Skill 3'], row['Skill 4']]
      .map(s => String(s || '').trim())
      .filter(s => s !== '' && s.toLowerCase() !== 'na');
    if (rowSkills.length > 0) skillsToProcess.push({ sessionId, skills: rowSkills });
  }

  log('New sessions to insert: ' + toInsert.length);
  log('Existing sessions to update: ' + toUpdate.length);

  // Insert new sessions in batches
  let insertedCount = 0;
  for (let i = 0; i < toInsert.length; i += 100) {
    const batch = toInsert.slice(i, i + 100);
    const { error: sInsErr } = await supabase.from('sessions').insert(batch);
    if (sInsErr) {
      warn('Insert batch ' + i + ': ' + sInsErr.message);
      for (const s of batch) {
        const { error: e2 } = await supabase.from('sessions').insert(s);
        if (!e2) insertedCount++;
        else warn('  Skip ' + s.session_date + ' ' + s.start_time + ': ' + e2.message);
      }
    } else {
      insertedCount += batch.length;
    }
  }

  // Update existing sessions
  let updatedCount = 0;
  for (const s of toUpdate) {
    const { id, ...fields } = s;
    const { error: uErr } = await supabase.from('sessions').update(fields).eq('id', id);
    if (uErr) warn('Update session ' + id + ': ' + uErr.message);
    else updatedCount++;
  }

  log('Inserted ' + insertedCount + ' new sessions');
  log('Updated  ' + updatedCount  + ' existing sessions');

  // --------------------------------------------------------------------------
  // STEP 6 - Skills + session_skills (additive only, never deletes)
  // --------------------------------------------------------------------------
  step('Step 6 - Skills and session_skills (additive only)...');

  // Collect all skill names from this Excel run
  const allSkillNames = new Set();
  for (const { skills } of skillsToProcess) for (const s of skills) allSkillNames.add(s);
  log('Unique skill names in Excel: ' + allSkillNames.size);

  // Fetch existing skills
  const { data: existingSkills } = await supabase.from('skills').select('id, name');
  const skillByName = {};
  for (const sk of (existingSkills || [])) skillByName[sk.name] = sk;

  // Insert only new skills
  const newSkills = [...allSkillNames]
    .filter(name => !skillByName[name])
    .map(name => ({ id: uuid(), name }));

  if (newSkills.length > 0) {
    for (let i = 0; i < newSkills.length; i += 100) {
      const { data: ins, error: skErr } = await supabase
        .from('skills').insert(newSkills.slice(i, i + 100)).select('id, name');
      if (skErr) warn('Skills insert: ' + skErr.message);
      else for (const sk of (ins || [])) skillByName[sk.name] = sk;
    }
    log('Inserted ' + newSkills.length + ' new skills');
  } else {
    log('No new skills to add');
  }

  // Re-fetch complete skill map
  const { data: allSkillsFinal } = await supabase.from('skills').select('id, name');
  for (const sk of (allSkillsFinal || [])) skillByName[sk.name] = sk;

  // Fetch existing session_skills to avoid duplicates
  const { data: existingSSLinks } = await supabase
    .from('session_skills').select('session_id, skill_id');
  const existingSSSet = new Set(
    (existingSSLinks || []).map(r => r.session_id + '::' + r.skill_id)
  );

  // Build only missing session_skills
  const newSSRows = [];
  const seen = new Set();
  for (const { sessionId, skills } of skillsToProcess) {
    for (const skillName of skills) {
      const sk = skillByName[skillName];
      if (!sk) continue;
      const key = sessionId + '::' + sk.id;
      if (seen.has(key) || existingSSSet.has(key)) continue;
      seen.add(key);
      newSSRows.push({ session_id: sessionId, skill_id: sk.id });
    }
  }

  let ssInserted = 0;
  for (let i = 0; i < newSSRows.length; i += 200) {
    const { error: ssErr } = await supabase
      .from('session_skills').insert(newSSRows.slice(i, i + 200));
    if (ssErr) warn('session_skills batch ' + i + ': ' + ssErr.message);
    else ssInserted += Math.min(200, newSSRows.length - i);
  }
  log('Inserted ' + ssInserted + ' new session_skills (' + existingSSSet.size + ' already existed)');

  // --------------------------------------------------------------------------
  // DONE
  // --------------------------------------------------------------------------
  console.log('\n================================================');
  console.log('  Import Complete! Safe to re-run anytime.');
  console.log('================================================');
  console.log('  Courses:             ' + Object.keys(courseByName).length);
  console.log('  Faculty:             ' + Object.keys(facultyByName).filter(k => facultyByName[k]).length);
  console.log('  Holiday sessions rm: ' + holidayDelCount);
  console.log('  Sessions inserted:   ' + insertedCount);
  console.log('  Sessions updated:    ' + updatedCount);
  console.log('  Skills total:        ' + Object.keys(skillByName).length);
  console.log('  Session-Skills new:  ' + ssInserted);
  console.log('\n  Visit /admin/reports to see the updated Master Report');
  console.log('================================================\n');
}

main().catch(e => { console.error('Fatal error: ' + e.message); process.exit(1); });
