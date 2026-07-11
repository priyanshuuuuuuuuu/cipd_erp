/**
 * Migration Script: Recalculate attendance points for all historical sessions
 *
 * OLD system: 0–1.0 scale
 * NEW system: 0–5 attendance + 0–1 bonus = 0–6 scale
 *
 * This script:
 *   1. Fetches all completed sessions
 *   2. For each session, fetches wifi_snapshots and enrolled students
 *   3. Recalculates attendance points using the new tier system
 *   4. Updates the `points` column in attendance_records
 *
 * Run: cd client-next && node scripts/migrate-attendance-points.mjs
 */

import { createClient } from '@supabase/supabase-js';

// ─── Supabase connection ──────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pvqxzbabstyhskhydbvl.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_SERVICE_KEY) throw new Error('SUPABASE_SERVICE_KEY env var is not set. Add it to .env before running.');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const normalizeMac = (mac) => {
  if (!mac) return '';
  return mac.trim().toUpperCase().replace(/[-.\s]/g, ':').replace(/:+/g, ':').replace(/^:|:$/g, '');
};
const isValidMac = (mac) => /^([A-F0-9]{2}:){5}[A-F0-9]{2}$/.test(mac);

async function migrate() {
  console.log('🚀 Starting attendance points migration...\n');

  // Fetch scanner settings
  const { data: settings } = await supabase
    .from('system_settings')
    .select('scanner_interval_minutes, min_signal, ping_interval, presence_threshold')
    .eq('id', 1)
    .single();

  const SCANNER_INTERVAL_MIN = settings?.scanner_interval_minutes || settings?.ping_interval || 6;
  console.log(`⚙️  Scanner interval: ${SCANNER_INTERVAL_MIN} min (signal filter disabled)\n`);

  // Fetch all completed sessions
  const { data: sessions, error: sessErr } = await supabase
    .from('sessions')
    .select('id, course_id, session_date, start_time, end_time, status')
    .eq('status', 'completed')
    .order('session_date', { ascending: true });

  if (sessErr || !sessions) {
    console.error('❌ Failed to fetch sessions:', sessErr?.message);
    process.exit(1);
  }

  console.log(`📋 Found ${sessions.length} completed sessions to process\n`);

  // Fetch all students with MAC addresses
  const { data: allStudents } = await supabase
    .from('students')
    .select('id, enrollment_no, mac_address, users ( first_name, last_name )');

  const studentMap = {};
  const macToStudentId = {};
  (allStudents || []).forEach(s => {
    studentMap[s.id] = {
      name: `${s.users?.first_name || ''} ${s.users?.last_name || ''}`.trim(),
      mac: s.mac_address ? normalizeMac(s.mac_address) : '',
    };
    if (s.mac_address) {
      macToStudentId[normalizeMac(s.mac_address)] = s.id;
    }
  });

  // Fetch all enrollments
  const { data: enrollments } = await supabase
    .from('course_enrollments')
    .select('student_id, course_id');

  const enrollmentMap = {};
  (enrollments || []).forEach(e => {
    if (!enrollmentMap[e.course_id]) enrollmentMap[e.course_id] = new Set();
    enrollmentMap[e.course_id].add(e.student_id);
  });

  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const session of sessions) {
    const courseId = session.course_id;
    const enrolledStudents = enrollmentMap[courseId];
    if (!enrolledStudents || enrolledStudents.size === 0) {
      console.log(`  ⏭️  Session ${session.id.slice(0, 8)} (${session.session_date}): No enrolled students, skipping`);
      continue;
    }

    // Build time window
    const date = session.session_date;
    const [sh, sm] = (session.start_time || '00:00:00').split(':').map(Number);
    const [eh, em] = (session.end_time || '23:59:00').split(':').map(Number);
    const sessionStartDate = new Date(`${date}T${session.start_time}+05:30`);
    const sessionEndDate = new Date(`${date}T${session.end_time}+05:30`);
    const sessionDurationMin = (eh * 60 + em) - (sh * 60 + sm);
    const expectedTotalSnapshots = Math.floor(sessionDurationMin / SCANNER_INTERVAL_MIN);
    sessionEndDate.setMinutes(sessionEndDate.getMinutes() + 2);

    // Fetch wifi snapshots
    const { data: snapshots } = await supabase
      .schema('public').from('wifi_snapshots')
      .select('id, iw_dump, captured_at')
      .gte('captured_at', sessionStartDate.toISOString())
      .lte('captured_at', sessionEndDate.toISOString())
      .order('captured_at', { ascending: true });

    const orderedSnapshotIds = (snapshots || []).map(s => s.id);
    const totalSnapshots = Math.max(orderedSnapshotIds.length, expectedTotalSnapshots);

    // Parse snapshots to build MAC -> snapshot presence
    const macToSnapshots = {};
    (snapshots || []).forEach(snap => {
      let clients = [];
      try {
        let dump = snap.iw_dump;
        if (typeof dump === 'string') dump = JSON.parse(dump);
        if (typeof dump === 'string') dump = JSON.parse(dump);
        clients = Array.isArray(dump) ? dump : [];
      } catch (e) { clients = []; }

      clients.forEach(c => {
        if (!c.mac || c.mac.trim() === '') return;
        const mac = normalizeMac(c.mac);
        if (!isValidMac(mac)) return;
        // Signal filter intentionally disabled — nmap devices have signal=null
        // which parses to 0 and would be incorrectly excluded.

        if (!macToSnapshots[mac]) macToSnapshots[mac] = new Set();
        macToSnapshots[mac].add(snap.id);
      });
    });

    // Fetch existing records to skip admin overrides
    const { data: existingRecords } = await supabase
      .from('attendance_records')
      .select('student_id, admin_override, penalty')
      .eq('session_id', session.id);

    const overriddenIds = new Set();
    (existingRecords || []).forEach(r => {
      if (r.admin_override || r.penalty) overriddenIds.add(r.student_id);
    });

    let sessionUpdated = 0;

    for (const studentId of enrolledStudents) {
      if (overriddenIds.has(studentId)) continue;

      const student = studentMap[studentId];
      if (!student) continue;

      const mac = student.mac;
      const studentSnapshots = mac ? (macToSnapshots[mac] || new Set()) : new Set();
      const pingCount = studentSnapshots.size;

      let attendancePoints = 0;
      let bonusPoints = 0;
      let status = 'absent';

      if (totalSnapshots > 0 && pingCount > 0) {
        const presencePercent = (pingCount / totalSnapshots) * 100;

        if (presencePercent >= 85) attendancePoints = 5;
        else if (presencePercent >= 70) attendancePoints = 4;
        else if (presencePercent >= 45) attendancePoints = 3;

        if (attendancePoints > 0) {
          status = 'present';
          const first2 = orderedSnapshotIds.slice(0, 2);
          const earlyPresent = first2.some(id => studentSnapshots.has(id));
          if (earlyPresent) bonusPoints = 1;
        }
      }

      const totalPoints = attendancePoints + bonusPoints;

      // Upsert into attendance_records
      const { error: upsertErr } = await supabase
        .from('attendance_records')
        .upsert({
          session_id: session.id,
          student_id: studentId,
          ping_count: pingCount,
          points: totalPoints,
          status,
          calculated_at: new Date().toISOString(),
        }, { onConflict: 'session_id,student_id', ignoreDuplicates: false });

      if (upsertErr) {
        totalErrors++;
      } else {
        sessionUpdated++;
        totalUpdated++;
      }
    }

    const snapshotInfo = (snapshots || []).length > 0 ? `${(snapshots || []).length} snapshots` : 'no snapshots';
    console.log(`  ✅ Session ${session.id.slice(0, 8)} (${session.session_date}): Updated ${sessionUpdated} students (${snapshotInfo})`);
  }

  console.log(`\n─────────────────────────────────────────`);
  console.log(`✅ Migration complete!`);
  console.log(`   Updated:  ${totalUpdated} records`);
  console.log(`   Skipped:  ${totalSkipped} (admin overrides)`);
  console.log(`   Errors:   ${totalErrors}`);
  console.log(`─────────────────────────────────────────\n`);
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
