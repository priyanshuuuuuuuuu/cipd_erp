/**
 * E2E Test — Automatic Feedback Rollout
 * Creates a 2-min mock session, inserts present attendance records,
 * waits for session to end, fires cron, then checks notifications.
 *
 * Usage: node scripts/test-feedback-rollout.mjs
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pvqxzbabstyhskhydbvl.supabase.co';
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cXh6YmFic3R5aHNraHlkYnZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjk4MDk1NiwiZXhwIjoyMDg4NTU2OTU2fQ.pAJKPZSmaKv60YVhtDBGGRg2bSH15ZmgV8hAeLWtMC4';
const APP_URL     = process.env.APP_URL    || 'http://localhost:3001';
const CRON_SECRET = process.env.CRON_SECRET || 'cipd-attendance-cron-2026';
const DURATION_MS = 2 * 60 * 1000; // 2 minutes

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const pad  = (n) => String(n).padStart(2, '0');
const ts   = () => new Date().toLocaleTimeString('en-IN', { hour12: false, timeZone: 'Asia/Kolkata' });
const log  = (msg) => console.log(`[${ts()}] ${msg}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Convert a JS Date to IST wall-clock values
function toIST(date) {
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  return {
    date:  `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())}`,
    time:  `${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}`,
    timeSS:`${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}:${pad(ist.getUTCSeconds())}`,
  };
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   Feedback Rollout — E2E Test                ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  // ── 1. Pick a course ───────────────────────────────────────────────────────
  log('Step 1: Finding a course...');
  const { data: courses } = await db.from('courses').select('id, name').limit(1);
  if (!courses?.length) { console.error('❌ No courses found'); process.exit(1); }
  const course = courses[0];
  log(`   Course: "${course.name}" (${course.id})`);

  // ── 2. Pick up to 3 students directly from students table ─────────────────
  log('Step 2: Finding students...');
  const { data: studentRows, error: stErr } = await db
    .from('students')
    .select('id, users(id, first_name, last_name, email)')
    .limit(3);

  if (stErr || !studentRows?.length) {
    console.error('❌ No students found:', stErr?.message);
    process.exit(1);
  }
  log(`   Found ${studentRows.length} student(s):`);
  studentRows.forEach((s) =>
    log(`     • ${s.users?.first_name} ${s.users?.last_name} (${s.users?.email}) — student_id: ${s.id}`)
  );

  // ── 3. Create session starting NOW, ending in 2 minutes (IST) ─────────────
  log('\nStep 3: Creating 2-min test session...');
  const startUTC = new Date();
  const endUTC   = new Date(startUTC.getTime() + DURATION_MS);
  const startIST = toIST(startUTC);
  const endIST   = toIST(endUTC);

  log(`   Date: ${startIST.date}  |  Start: ${startIST.time}  |  End: ${endIST.time} (IST)`);

  const { data: session, error: sessErr } = await db
    .from('sessions')
    .insert({
      course_id:    course.id,
      title:        `[TEST] Feedback Rollout ${new Date().toISOString()}`,
      session_date: startIST.date,
      start_time:   startIST.time,
      end_time:     endIST.time,
      status:       'scheduled',
    })
    .select()
    .single();

  if (sessErr || !session) {
    console.error('❌ Failed to create session:', sessErr?.message);
    process.exit(1);
  }
  log(`   ✓ Session created: ${session.id}`);

  // ── 4. Insert mock attendance records (status = 'present') ─────────────────
  log('\nStep 4: Inserting mock attendance records...');
  const attendanceRows = studentRows.map((s) => ({
    session_id:    session.id,
    student_id:    s.id,         // this is already the students.id PK
    status:        'present',
    ping_count:    5,
    points:        null,
    calculated_at: new Date().toISOString(),
  }));

  const { error: attErr } = await db.from('attendance_records').insert(attendanceRows);
  if (attErr) {
    log(`   ⚠ Attendance insert error: ${attErr.message}`);
    log('   Continuing anyway — rollout may notify 0 students');
  } else {
    log(`   ✓ Inserted ${attendanceRows.length} record(s) as "present"`);
  }

  // ── 5. Wait for session to end ─────────────────────────────────────────────
  const waitMs = DURATION_MS + 15000; // +15s buffer
  log(`\nStep 5: Waiting ${DURATION_MS / 60000} min + 15s for session to end...`);
  for (let rem = Math.ceil(waitMs / 1000); rem > 0; rem -= 5) {
    process.stdout.write(`\r   ⏳ ${rem}s remaining...   `);
    await wait(Math.min(5000, rem * 1000));
  }
  console.log('\r   ✅ Session has ended!              ');

  // ── 6. Fire the cron ───────────────────────────────────────────────────────
  log('\nStep 6: Firing cron endpoint...');
  let cronResult;
  try {
    const res = await fetch(`${APP_URL}/api/cron/process-attendance`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    cronResult = await res.json();
    log(`   Response: "${cronResult.message}"`);
    log(`   Active processed: ${cronResult.sessionsProcessed} | Missed completed: ${cronResult.missedSessionsCompleted}`);
  } catch (e) {
    console.error('❌ Cron call failed:', e.message);
  }

  log('   Waiting 4s for async rollout to settle...');
  await wait(4000);

  // ── 7. Check results ───────────────────────────────────────────────────────
  log('\nStep 7: Checking results...');

  // Check session status
  const { data: updSess } = await db.from('sessions').select('status').eq('id', session.id).single();
  log(`   Session status: ${updSess?.status ?? '(not found — may be deleted already)'}`);

  // Check notifications
  const { data: notifs, error: nErr } = await db
    .from('notifications')
    .select('id, recipient_id, title, message, created_at')
    .eq('session_id', session.id)
    .eq('type', 'feedback_available');

  if (nErr) {
    log(`   ❌ Notification query error: ${nErr.message}`);
  } else if (!notifs?.length) {
    log('   ⚠  No feedback_available notifications found.');
    log('      Possible reasons:');
    log('      - Session status was already "completed" (Pass 2 skips already-completed)');
    log('      - Attendance records had a conflict (upsert issue)');
    log('      - Cron IST/UTC mismatch still present');
  } else {
    log(`   ✅ ${notifs.length} notification(s) created!`);
    notifs.forEach((n, i) => {
      log(`   [${i+1}] recipient: ${n.recipient_id}`);
      log(`        title: ${n.title}`);
    });
  }

  // ── 8. Cleanup ─────────────────────────────────────────────────────────────
  log('\nStep 8: Cleaning up...');
  await db.from('notifications').delete().eq('session_id', session.id);
  await db.from('attendance_records').delete().eq('session_id', session.id);
  await db.from('sessions').delete().eq('id', session.id);
  log('   ✓ Test data deleted.');

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════╗');
  if (notifs?.length > 0) {
    console.log('║  ✅  TEST PASSED                              ║');
    console.log(`║  ${notifs.length} student(s) got feedback notification(s).  ║`);
  } else {
    console.log('║  ❌  TEST FAILED — 0 notifications sent       ║');
  }
  console.log('╚══════════════════════════════════════════════╝\n');
}

main().catch((err) => { console.error('\n❌ Fatal:', err); process.exit(1); });
