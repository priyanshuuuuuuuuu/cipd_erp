export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';

/**
 * Global Engagement Leaderboard
 *
 * Points per session:
 *   Attendance : 0–5 (based on ping presence %)
 *   Bonus      : 0–1 (present in first 8 min)
 *   Feedback   : 0–3 (submitted feedback form for session)
 *   Max/session: 9
 *
 * Leaderboard aggregates ALL session points globally.
 */

const normalizeMac = (mac) => {
  if (!mac) return '';
  return mac.trim().toUpperCase().replace(/[-.\s]/g, ':').replace(/:+/g, ':').replace(/^:|:$/g, '');
};
const isValidMac = (mac) => /^([A-F0-9]{2}:){5}[A-F0-9]{2}$/.test(mac);

async function handler(req) {
  try {
    // 1. Fetch all completed sessions
    const { data: sessions } = await supabaseAdmin
      .from('sessions')
      .select('id, course_id, session_date, start_time, end_time, status')
      .eq('status', 'completed')
      .order('session_date', { ascending: true });

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ leaderboard: [], meta: { totalSessions: 0 } });
    }

    // 2. Fetch all students
    const { data: allStudents } = await supabaseAdmin
      .from('students')
      .select('id, enrollment_no, mac_address, users ( first_name, last_name )');

    const studentMap = {};
    const macToStudentId = {};
    (allStudents || []).forEach(s => {
      studentMap[s.id] = {
        name: `${s.users?.first_name || ''} ${s.users?.last_name || ''}`.trim() || 'Unknown',
        enrollment_no: s.enrollment_no || '',
        mac: s.mac_address ? normalizeMac(s.mac_address) : '',
      };
      if (s.mac_address) {
        macToStudentId[normalizeMac(s.mac_address)] = s.id;
      }
    });

    // 3. Fetch all enrollments (to know which students belong to which course)
    const { data: enrollments } = await supabaseAdmin
      .from('course_enrollments')
      .select('student_id, course_id');

    const enrollmentMap = {};  // courseId -> Set of studentIds
    (enrollments || []).forEach(e => {
      if (!enrollmentMap[e.course_id]) enrollmentMap[e.course_id] = new Set();
      enrollmentMap[e.course_id].add(e.student_id);
    });

    // 4. Fetch all feedback responses (to know who submitted feedback for which session)
    const { data: feedbackResponses } = await supabaseAdmin
      .from('feedback_responses')
      .select('student_id, session_id')
      .not('rating', 'is', null);

    // Build set of "studentId:sessionId" for quick lookup
    const feedbackSet = new Set();
    (feedbackResponses || []).forEach(r => {
      feedbackSet.add(`${r.student_id}:${r.session_id}`);
    });

    // 5. Fetch scanner settings
    const { data: settings } = await supabaseAdmin
      .from('system_settings')
      .select('scanner_interval_minutes, min_signal, ping_interval, presence_threshold')
      .eq('id', 1)
      .single();

    const SCANNER_INTERVAL_MIN = settings?.scanner_interval_minutes || settings?.ping_interval || 6;
    const MIN_SIGNAL = settings?.min_signal ?? settings?.presence_threshold ?? 2;

    // 6. Process each session
    // Accumulate points: studentId -> { attendance, bonus, feedback, sessions }
    const pointsMap = {};

    for (const session of sessions) {
      const courseId = session.course_id;
      const enrolledStudents = enrollmentMap[courseId];
      if (!enrolledStudents || enrolledStudents.size === 0) continue;

      // Build time window
      const date = session.session_date;
      const [sh, sm] = (session.start_time || '00:00:00').split(':').map(Number);
      const [eh, em] = (session.end_time || '23:59:00').split(':').map(Number);
      const sessionStartDate = new Date(`${date}T${session.start_time}+05:30`);
      const sessionEndDate = new Date(`${date}T${session.end_time}+05:30`);
      const sessionDurationMin = (eh * 60 + em) - (sh * 60 + sm);
      const expectedTotalSnapshots = Math.floor(sessionDurationMin / SCANNER_INTERVAL_MIN);
      sessionEndDate.setMinutes(sessionEndDate.getMinutes() + 2);

      // Fetch wifi snapshots for this session's time window
      const { data: snapshots } = await supabaseAdmin
        .from('wifi_snapshots')
        .select('id, iw_dump, captured_at')
        .gte('captured_at', sessionStartDate.toISOString())
        .lte('captured_at', sessionEndDate.toISOString())
        .order('captured_at', { ascending: true });

      const orderedSnapshotIds = (snapshots || []).map(s => s.id);
      const totalSnapshots = Math.max(orderedSnapshotIds.length, expectedTotalSnapshots);

      // Parse snapshots to build MAC -> snapshot presence
      const macToSnapshots = {};  // mac -> Set of snapshot IDs
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
          const sig = parseInt(c.signal) || 0;
          if (sig <= MIN_SIGNAL) return;

          if (!macToSnapshots[mac]) macToSnapshots[mac] = new Set();
          macToSnapshots[mac].add(snap.id);
        });
      });

      // Calculate points for each enrolled student
      enrolledStudents.forEach(studentId => {
        const student = studentMap[studentId];
        if (!student) return;

        if (!pointsMap[studentId]) {
          pointsMap[studentId] = {
            name: student.name,
            enrollment_no: student.enrollment_no,
            attendancePoints: 0,
            bonusPoints: 0,
            feedbackPoints: 0,
            totalPoints: 0,
            sessionsEnrolled: 0,
            sessionsAttended: 0,
          };
        }
        pointsMap[studentId].sessionsEnrolled++;

        // ── Attendance + Bonus ──
        const mac = student.mac;
        const studentSnapshots = mac ? (macToSnapshots[mac] || new Set()) : new Set();
        const pingCount = studentSnapshots.size;

        let attendancePoints = 0;
        let bonusPoints = 0;

        if (totalSnapshots > 0 && pingCount > 0) {
          const presencePercent = (pingCount / totalSnapshots) * 100;

          if (presencePercent >= 85) attendancePoints = 5;
          else if (presencePercent >= 70) attendancePoints = 4;
          else if (presencePercent >= 45) attendancePoints = 3;
          // else 0

          // Bonus: present in first 2 snapshots
          if (attendancePoints > 0) {
            const first2 = orderedSnapshotIds.slice(0, 2);
            const earlyPresent = first2.some(id => studentSnapshots.has(id));
            if (earlyPresent) bonusPoints = 1;

            pointsMap[studentId].sessionsAttended++;
          }
        }

        // ── Feedback ──
        const hasFeedback = feedbackSet.has(`${studentId}:${session.id}`);
        const feedbackPoints = hasFeedback ? 3 : 0;

        pointsMap[studentId].attendancePoints += attendancePoints;
        pointsMap[studentId].bonusPoints += bonusPoints;
        pointsMap[studentId].feedbackPoints += feedbackPoints;
        pointsMap[studentId].totalPoints += attendancePoints + bonusPoints + feedbackPoints;
      });
    }

    // 7. Build and sort leaderboard
    const leaderboard = Object.entries(pointsMap)
      .map(([studentId, data]) => ({
        student_id: studentId,
        ...data,
        maxPossible: data.sessionsEnrolled * 9,
      }))
      .filter(s => s.sessionsEnrolled > 0)
      .sort((a, b) => {
        // Sort by total points desc, then by attendance rate desc
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        return b.sessionsAttended - a.sessionsAttended;
      })
      .map((s, i) => ({
        rank: i + 1,
        ...s,
      }));

    return NextResponse.json({
      leaderboard,
      meta: {
        totalSessions: sessions.length,
        maxPerSession: 9,
        breakdown: '5 attendance + 1 bonus + 3 feedback',
      },
    });
  } catch (err) {
    console.error('Leaderboard error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
