export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';
import { normalizeMac } from '@/lib/attendance-mac';
import {
  buildMacTimeline,
  loadAttendanceSettings,
} from '@/lib/process-session-attendance';
import { resolveAttendanceStatus, liveStatusLabel } from '@/lib/attendance-points';

async function handler(req) {
  try {
    const studentId = req.user.id;

    const { data: student } = await supabaseAdmin
      .from('students')
      .select('mac_address, mac_verified')
      .eq('id', studentId)
      .single();

    const macVerified = student?.mac_verified && student?.mac_address;
    const studentMac = macVerified ? normalizeMac(student.mac_address) : null;

    const now = new Date();
    const nowIST = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    const today = nowIST.toISOString().split('T')[0];
    const currentTime = `${String(nowIST.getHours()).padStart(2, '0')}:${String(nowIST.getMinutes()).padStart(2, '0')}:${String(nowIST.getSeconds()).padStart(2, '0')}`;

    const { data: enrollments } = await supabaseAdmin
      .from('course_enrollments')
      .select('course_id')
      .eq('student_id', studentId);

    const courseIds = (enrollments || []).map((e) => e.course_id);
    if (courseIds.length === 0) {
      return NextResponse.json({ sessions: [], date: today });
    }

    const { data: sessions } = await supabaseAdmin
      .from('sessions')
      .select(`
        id, title, session_date, start_time, end_time, status, course_id,
        courses ( id, name )
      `)
      .in('course_id', courseIds)
      .eq('session_date', today)
      .neq('status', 'cancelled')
      .lte('start_time', currentTime)
      .gt('end_time', currentTime)
      .order('start_time', { ascending: true });

    if (!sessions?.length) {
      return NextResponse.json({ sessions: [], date: today });
    }

    const { data: leaves } = await supabaseAdmin
      .from('leave_requests')
      .select('session_id, status')
      .eq('student_id', studentId)
      .eq('leave_date', today)
      .in('status', ['pending', 'approved']);

    const leaveBySession = {};
    (leaves || []).forEach((l) => {
      if (l.session_id) leaveBySession[l.session_id] = l.status;
    });

    const { minSignal } = await loadAttendanceSettings();
    const liveSessions = [];

    for (const session of sessions) {
      const sessionStart = new Date(`${today}T${session.start_time}+05:30`);
      const sessionEnd = new Date(`${today}T${session.end_time}+05:30`);

      const { data: snapshots } = await supabaseAdmin
        .from('wifi_snapshots')
        .select('id, iw_dump, captured_at')
        .gte('captured_at', sessionStart.toISOString())
        .lte('captured_at', now.toISOString())
        .order('captured_at', { ascending: true });

      const { macTimeline, orderedSnapshotIds } = buildMacTimeline(
        snapshots || [],
        minSignal
      );

      let detected = false;
      let pingCount = 0;

      if (studentMac && macTimeline[studentMac]) {
        detected = true;
        pingCount = new Set(
          macTimeline[studentMac].map((t) => t.snapshotId)
        ).size;
      }

      const leaveStatus = leaveBySession[session.id];
      const leaveApproved = leaveStatus === 'approved';
      const leavePending = leaveStatus === 'pending';

      let dbStatus;
      if (leavePending) {
        dbStatus = 'leave';
      } else {
        dbStatus = resolveAttendanceStatus({
          presencePercent: 0,
          detected,
          leaveApproved,
          finalizeAbsent: false,
          isOngoing: true,
        });
      }

      let label;
      if (!macVerified) {
        label = 'Not tracked';
      } else if (leavePending) {
        label = 'Leave Pending';
      } else {
        label = liveStatusLabel(dbStatus, true);
      }

      liveSessions.push({
        sessionId: session.id,
        title: session.title,
        courseName: session.courses?.name || '',
        startTime: session.start_time?.slice(0, 5),
        endTime: session.end_time?.slice(0, 5),
        liveStatus: label,
        pingCount: macVerified ? pingCount : null,
        isOngoing: true,
        points: null,
        macVerified: !!macVerified,
      });
    }

    return NextResponse.json({ sessions: liveSessions, date: today });
  } catch (err) {
    console.error('Live attendance error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
