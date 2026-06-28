export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';
import { normalizeMac } from '@/lib/attendance-mac';
import {
  buildMacTimeline,
  loadAttendanceSettings,
  loadApprovedLeaves,
  processSessionAttendance,
} from '@/lib/process-session-attendance';
import {
  calculatePoints,
  resolveAttendanceStatus,
} from '@/lib/attendance-points';

async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }

    const { data: session, error: sessErr } = await supabaseAdmin
      .from('sessions')
      .select(`
        id, title, session_date, start_time, end_time, status, course_id,
        courses ( id, name ),
        venues ( id, name, building, router_bssid )
      `)
      .eq('id', sessionId)
      .single();

    if (sessErr || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const courseId = session.courses?.id || session.course_id;
    const date = session.session_date;
    const { scannerIntervalMin, minSignal } = await loadAttendanceSettings();

    const sessionStartDate = new Date(`${date}T${session.start_time}+05:30`);
    const sessionEndDate = new Date(`${date}T${session.end_time}+05:30`);
    const [sh, sm] = (session.start_time || '00:00:00').split(':').map(Number);
    const [eh, em] = (session.end_time || '23:59:00').split(':').map(Number);
    const sessionDurationMin = eh * 60 + em - (sh * 60 + sm);
    const expectedTotalSnapshots = Math.floor(
      sessionDurationMin / scannerIntervalMin
    );

    const windowEnd = new Date(sessionEndDate);
    windowEnd.setMinutes(windowEnd.getMinutes() + 2);

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const isOngoing =
      date === today &&
      session.start_time <= currentTime &&
      session.end_time > currentTime;
    const finalizeAbsent = !isOngoing;

    const { data: snapshots } = await supabaseAdmin
      .from('wifi_snapshots')
      .select('id, iw_dump, captured_at')
      .gte('captured_at', sessionStartDate.toISOString())
      .lte('captured_at', windowEnd.toISOString())
      .order('captured_at', { ascending: true });

    const { macTimeline, orderedSnapshotIds } = buildMacTimeline(
      snapshots || [],
      minSignal
    );

    const { data: enrollments } = await supabaseAdmin
      .from('course_enrollments')
      .select('student_id')
      .eq('course_id', courseId);

    const enrolledStudentIds = new Set(
      (enrollments || []).map((e) => e.student_id)
    );

    const { data: allStudents } = await supabaseAdmin
      .from('students')
      .select(
        'id, enrollment_no, program_name, mac_address, mac_verified, users ( first_name, last_name, email )'
      );

    const studentMap = {};
    (allStudents || []).forEach((s) => {
      studentMap[s.id] = s;
    });

    const verifiedEnrolled = (allStudents || []).filter(
      (s) =>
        enrolledStudentIds.has(s.id) &&
        s.mac_verified &&
        s.mac_address
    );

    const approvedLeaves = await loadApprovedLeaves(
      sessionId,
      date,
      verifiedEnrolled.map((s) => s.id)
    );

    const { data: existingRecords } = await supabaseAdmin
      .from('attendance_records')
      .select(
        'student_id, status, points, admin_override, penalty, penalty_reason'
      )
      .eq('session_id', sessionId);

    const existingMap = {};
    (existingRecords || []).forEach((r) => {
      existingMap[r.student_id] = r;
    });

    await processSessionAttendance(
      { ...session, course_id: courseId },
      { isOngoing, finalizeAbsent, upsert: true, now }
    );

    const { data: refreshedRecords } = await supabaseAdmin
      .from('attendance_records')
      .select(
        'student_id, status, points, ping_count, first_seen_at, last_seen_at, duration_minutes, admin_override, penalty, penalty_reason'
      )
      .eq('session_id', sessionId);

    const recordMap = {};
    (refreshedRecords || []).forEach((r) => {
      recordMap[r.student_id] = r;
    });

    const studentResults = [];

    enrolledStudentIds.forEach((studentId) => {
      const student = studentMap[studentId];
      if (!student) return;

      const name =
        `${student.users?.first_name || ''} ${student.users?.last_name || ''}`.trim();
      const mac = student.mac_address ? normalizeMac(student.mac_address) : '';
      const timeline = mac ? macTimeline[mac] || [] : [];
      const existing = recordMap[studentId] || existingMap[studentId];

      if (!student.mac_verified || !student.mac_address) {
        studentResults.push({
          studentId: student.id,
          enrollmentNo: student.enrollment_no || '',
          name,
          email: student.users?.email || '',
          program: student.program_name || '',
          macAddress: mac || '—',
          macVerified: false,
          signal: timeline.length ? timeline[timeline.length - 1].signal : 0,
          avgSignal: 0,
          firstSeen: null,
          lastSeen: null,
          durationMinutes: 0,
          pingCount: 0,
          points: null,
          pointsBreakdown: { reason: 'MAC not verified — attendance not tracked' },
          status: 'unverified',
          adminOverride: false,
          penalty: false,
          penaltyReason: '',
          deviceName: timeline.length ? timeline[timeline.length - 1].deviceName : '',
          pings: [],
        });
        return;
      }

      if (existing && (existing.admin_override || existing.penalty)) {
        studentResults.push({
          studentId: student.id,
          enrollmentNo: student.enrollment_no || '',
          name,
          email: student.users?.email || '',
          program: student.program_name || '',
          macAddress: mac,
          macVerified: true,
          signal: 0,
          avgSignal: 0,
          firstSeen: existing.first_seen_at,
          lastSeen: existing.last_seen_at,
          durationMinutes: existing.duration_minutes || 0,
          pingCount: existing.ping_count || 0,
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

      const detected = timeline.length > 0;
      let pingCount = 0;
      let firstSeen = null;
      let lastSeen = null;
      let durationMinutes = 0;
      let avgSignal = 0;
      let latestSignal = 0;

      if (detected) {
        const uniqueSnapshots = new Set(timeline.map((t) => t.snapshotId));
        pingCount = uniqueSnapshots.size;
        firstSeen = timeline[0].time;
        lastSeen = timeline[timeline.length - 1].time;
        durationMinutes =
          Math.round(((lastSeen - firstSeen) / 60000) * 10) / 10;
        avgSignal =
          Math.round(
            (timeline.reduce((a, t) => a + t.signal, 0) / timeline.length) * 10
          ) / 10;
        latestSignal = timeline[timeline.length - 1].signal;
      }

      const totalSnapshots = Math.max(
        orderedSnapshotIds.length,
        expectedTotalSnapshots || 0
      );
      const presencePercent =
        totalSnapshots > 0 ? (pingCount / totalSnapshots) * 100 : 0;

      const scoring = calculatePoints({
        firstSeenAt: firstSeen,
        sessionStartAt: sessionStartDate,
        sessionEndAt: sessionEndDate,
        pingCount,
        orderedSnapshotIds,
        expectedTotalSnapshots,
        leaveApproved: approvedLeaves.has(student.id),
        detected,
        finalizeAbsent,
      });

      const status = resolveAttendanceStatus({
        presencePercent: scoring.presencePercent ?? presencePercent,
        detected,
        leaveApproved: approvedLeaves.has(student.id),
        finalizeAbsent,
        isOngoing,
      });

      const displayPoints = isOngoing ? 0 : (existing?.points ?? scoring.points);

      studentResults.push({
        studentId: student.id,
        enrollmentNo: student.enrollment_no || '',
        name,
        email: student.users?.email || '',
        program: student.program_name || '',
        macAddress: mac,
        macVerified: true,
        signal: latestSignal,
        avgSignal,
        firstSeen: firstSeen ? firstSeen.toISOString() : null,
        lastSeen: lastSeen ? lastSeen.toISOString() : null,
        durationMinutes,
        pingCount,
        points: displayPoints,
        pointsBreakdown: scoring.breakdown,
        status,
        adminOverride: false,
        penalty: false,
        penaltyReason: '',
        deviceName: detected ? timeline[timeline.length - 1].deviceName || '' : '',
        pings: timeline.map((t) => ({
          time: t.time.toISOString(),
          signal: t.signal,
          snapshotId: t.snapshotId,
        })),
      });
    });

    const statusOrder = { present: 0, partial: 1, leave: 2, absent: 3, unverified: 4 };
    studentResults.sort((a, b) => {
      const so =
        (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5);
      if (so !== 0) return so;
      return (b.points || 0) - (a.points || 0);
    });

    const presentCount = studentResults.filter((s) => s.status === 'present').length;
    const partialCount = studentResults.filter((s) => s.status === 'partial').length;
    const absentCount = studentResults.filter((s) => s.status === 'absent').length;
    const leaveCount = studentResults.filter((s) => s.status === 'leave').length;

    const lastSnapshotTime =
      snapshots && snapshots.length > 0
        ? snapshots[snapshots.length - 1].captured_at
        : null;

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
        leave: leaveCount,
        snapshotsAnalyzed: (snapshots || []).length,
        expectedTotalSnapshots,
        scannerInterval: scannerIntervalMin,
      },
      snapshotTimestamps: (snapshots || []).map((s) => s.captured_at),
      lastSnapshot: lastSnapshotTime,
      isOngoing,
    });
  } catch (err) {
    console.error('Session students error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(handler, ['admin']);
