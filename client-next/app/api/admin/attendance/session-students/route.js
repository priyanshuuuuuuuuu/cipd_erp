export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';
import { calculatePoints } from '@/lib/attendance-points';

const normalizeMac = (mac) => {
  if (!mac) return '';
  return mac.trim().toUpperCase().replace(/[-.\s]/g, ':').replace(/:+/g, ':').replace(/^:|:$/g, '');
};
const isValidMac = (mac) => /^([A-F0-9]{2}:){5}[A-F0-9]{2}$/.test(mac);
const MIN_SIGNAL = 2;

async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }

    // 1. Fetch session with course info
    const { data: session, error: sessErr } = await supabaseAdmin
      .from('sessions')
      .select(`
        id, title, session_date, start_time, end_time, status,
        courses ( id, name ),
        venues ( id, name, building, router_bssid )
      `)
      .eq('id', sessionId)
      .single();

    if (sessErr || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const date = session.session_date;
    const courseId = session.courses?.id;

    // 2. Build time window
    const [sh, sm] = (session.start_time || '00:00:00').split(':').map(Number);
    const [eh, em] = (session.end_time || '23:59:00').split(':').map(Number);
    const sessionStartDate = new Date(`${date}T${session.start_time}+05:30`);
    const sessionEndDate = new Date(`${date}T${session.end_time}+05:30`);
    sessionEndDate.setMinutes(sessionEndDate.getMinutes() + 2);
    const sessionDurationMin = (eh * 60 + em) - (sh * 60 + sm);

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const isToday = date === today;
    const isOngoing = isToday && session.start_time <= currentTime && session.end_time > currentTime;

    // 3. Fetch ALL enrolled students for this course
    const { data: enrollments } = await supabaseAdmin
      .from('course_enrollments')
      .select('student_id')
      .eq('course_id', courseId);

    const enrolledStudentIds = new Set((enrollments || []).map(e => e.student_id));

    // 4. Fetch student details for enrolled students
    const { data: allStudents } = await supabaseAdmin
      .from('students')
      .select('id, enrollment_no, program_name, mac_address, mac_verified, users ( first_name, last_name, email )');

    const studentMap = {};
    const macToStudent = {};
    (allStudents || []).forEach(s => {
      studentMap[s.id] = s;
      if (s.mac_address) {
        macToStudent[normalizeMac(s.mac_address)] = s;
      }
    });

    // 5. Fetch existing attendance_records for this session (to detect admin overrides)
    const { data: existingRecords } = await supabaseAdmin
      .from('attendance_records')
      .select('student_id, status, points, admin_override, penalty, penalty_reason')
      .eq('session_id', sessionId);

    const existingMap = {};
    (existingRecords || []).forEach(r => {
      existingMap[r.student_id] = r;
    });

    // 6. Fetch wifi_snapshots
    const { data: snapshots } = await supabaseAdmin
      .from('wifi_snapshots')
      .select('id, iw_dump, captured_at')
      .gte('captured_at', sessionStartDate.toISOString())
      .lte('captured_at', sessionEndDate.toISOString())
      .order('captured_at', { ascending: true });

    // 7. Parse snapshots → MAC timeline
    const macTimeline = {};
    const orderedSnapshotIds = (snapshots || []).map(s => s.id);

    (snapshots || []).forEach(snap => {
      let clients = [];
      try {
        let dump = snap.iw_dump;
        if (typeof dump === 'string') dump = JSON.parse(dump);
        if (typeof dump === 'string') dump = JSON.parse(dump);
        clients = Array.isArray(dump) ? dump : [];
      } catch (e) { clients = []; }

      const snapTime = new Date(snap.captured_at);
      clients.forEach(c => {
        if (!c.mac || c.mac.trim() === '') return;
        const mac = normalizeMac(c.mac);
        if (!isValidMac(mac)) return;
        const sig = parseInt(c.signal) || 0;
        if (sig <= MIN_SIGNAL) return;

        if (!macTimeline[mac]) macTimeline[mac] = [];
        macTimeline[mac].push({
          snapshotId: snap.id, time: snapTime, signal: sig,
          deviceName: c.name || '', ip: c.ip || '',
        });
      });
    });

    // 8. Build results for ALL enrolled students
    const studentResults = [];
    const upsertRecords = [];

    enrolledStudentIds.forEach(studentId => {
      const student = studentMap[studentId];
      if (!student) return;

      const name = `${student.users?.first_name || ''} ${student.users?.last_name || ''}`.trim();
      const mac = student.mac_address ? normalizeMac(student.mac_address) : '';
      const timeline = mac ? (macTimeline[mac] || []) : [];
      const existing = existingMap[studentId];

      // If admin_override or penalty exists, use stored values — don't recalculate
      if (existing && (existing.admin_override || existing.penalty)) {
        studentResults.push({
          studentId: student.id,
          enrollmentNo: student.enrollment_no || '',
          name,
          email: student.users?.email || '',
          program: student.program_name || '',
          macAddress: mac,
          macVerified: student.mac_verified || false,
          signal: 0,
          avgSignal: 0,
          firstSeen: null,
          lastSeen: null,
          durationMinutes: 0,
          pingCount: 0,
          points: existing.points || 0,
          pointsBreakdown: {
            reason: existing.penalty
              ? `Penalty: ${existing.penalty_reason || 'Faking attendance'}`
              : 'Admin override',
          },
          status: existing.status || 'absent',
          adminOverride: existing.admin_override || false,
          penalty: existing.penalty || false,
          penaltyReason: existing.penalty_reason || '',
          deviceName: '',
          pings: [],
        });
        return;
      }

      // Calculate from WiFi data
      if (timeline.length > 0) {
        const uniqueSnapshots = new Set(timeline.map(t => t.snapshotId));
        const pingCount = uniqueSnapshots.size;
        const firstSeen = timeline[0].time;
        const lastSeen = timeline[timeline.length - 1].time;
        const durationMs = lastSeen.getTime() - firstSeen.getTime();
        const durationMinutes = Math.round(durationMs / 60000 * 10) / 10;
        const avgSignal = Math.round(timeline.reduce((a, t) => a + t.signal, 0) / timeline.length * 10) / 10;
        const latestSignal = timeline[timeline.length - 1].signal;

        const { points, status: pointsStatus, breakdown } = calculatePoints(uniqueSnapshots, orderedSnapshotIds);
        let status = pointsStatus;
        if (isOngoing && pingCount > 0 && pingCount < 3 && status !== 'absent') {
          status = 'partial';
        }

        studentResults.push({
          studentId: student.id,
          enrollmentNo: student.enrollment_no || '',
          name,
          email: student.users?.email || '',
          program: student.program_name || '',
          macAddress: mac,
          macVerified: student.mac_verified || false,
          signal: latestSignal,
          avgSignal,
          firstSeen: firstSeen.toISOString(),
          lastSeen: lastSeen.toISOString(),
          durationMinutes,
          pingCount,
          points,
          pointsBreakdown: breakdown,
          status,
          adminOverride: false,
          penalty: false,
          penaltyReason: '',
          deviceName: timeline[timeline.length - 1].deviceName || '',
          pings: timeline.map(t => ({
            time: t.time.toISOString(), signal: t.signal, snapshotId: t.snapshotId,
          })),
        });

        // Queue for upsert (only auto-calculated, skip admin overrides)
        upsertRecords.push({
          session_id: sessionId,
          student_id: student.id,
          ping_count: pingCount,
          points,
          status,
          calculated_at: now.toISOString(),
        });
      } else {
        // Not detected at all — absent with 0 points
        studentResults.push({
          studentId: student.id,
          enrollmentNo: student.enrollment_no || '',
          name,
          email: student.users?.email || '',
          program: student.program_name || '',
          macAddress: mac || '—',
          macVerified: student.mac_verified || false,
          signal: 0,
          avgSignal: 0,
          firstSeen: null,
          lastSeen: null,
          durationMinutes: 0,
          pingCount: 0,
          points: 0,
          pointsBreakdown: { reason: 'Not detected' },
          status: 'absent',
          adminOverride: false,
          penalty: false,
          penaltyReason: '',
          deviceName: '',
          pings: [],
        });
      }
    });

    // 9. Sort: present → partial → absent
    const statusOrder = { present: 0, partial: 1, absent: 2 };
    studentResults.sort((a, b) => {
      const so = (statusOrder[a.status] || 2) - (statusOrder[b.status] || 2);
      if (so !== 0) return so;
      return (b.points || 0) - (a.points || 0);
    });

    // 10. Upsert only auto-calculated records (skip overridden ones)
    if (upsertRecords.length > 0) {
      // Filter out students that have admin_override or penalty
      const overriddenIds = new Set(
        Object.entries(existingMap)
          .filter(([, r]) => r.admin_override || r.penalty)
          .map(([id]) => id)
      );
      const safeRecords = upsertRecords.filter(r => !overriddenIds.has(r.student_id));

      if (safeRecords.length > 0) {
        const { error: upsertErr } = await supabaseAdmin
          .from('attendance_records')
          .upsert(safeRecords, { onConflict: 'session_id,student_id', ignoreDuplicates: false });
        if (upsertErr) console.error('Attendance upsert error:', upsertErr);
      }
    }

    const presentCount = studentResults.filter(s => s.status === 'present').length;
    const partialCount = studentResults.filter(s => s.status === 'partial').length;
    const absentCount = studentResults.filter(s => s.status === 'absent').length;

    const lastSnapshotTime = snapshots && snapshots.length > 0
      ? snapshots[snapshots.length - 1].captured_at : null;

    return NextResponse.json({
      session: {
        id: session.id,
        title: session.title,
        date: session.session_date,
        startTime: session.start_time,
        endTime: session.end_time,
        status: isOngoing ? 'ongoing' : session.status,
        courseName: session.courses?.name || '',
        courseId,
        venueName: session.venues?.name || '',
        venueBuilding: session.venues?.building || '',
        durationMinutes: sessionDurationMin,
      },
      students: studentResults,
      summary: {
        total: studentResults.length,
        enrolled: enrolledStudentIds.size,
        present: presentCount,
        partial: partialCount,
        absent: absentCount,
        snapshotsAnalyzed: (snapshots || []).length,
      },
      lastSnapshot: lastSnapshotTime,
      isOngoing,
    });
  } catch (err) {
    console.error('Session students error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(handler, ['admin']);
