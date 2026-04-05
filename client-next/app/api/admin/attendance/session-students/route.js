export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';
import { calculatePoints } from '@/lib/attendance-points';

// Robust MAC normalizer — handles dashes, dots, mixed case
const normalizeMac = (mac) => {
  if (!mac) return '';
  return mac
    .trim()
    .toUpperCase()
    .replace(/[-.\s]/g, ':')
    .replace(/:+/g, ':')
    .replace(/^:|:$/g, '');
};
const isValidMac = (mac) => /^([A-F0-9]{2}:){5}[A-F0-9]{2}$/.test(mac);

const MIN_SIGNAL = 2; // Reject devices with signal <= 2

async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }

    // 1. Fetch the session details
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

    // 2. Build time window: start_time → end_time + 2 minutes
    const [sh, sm, ss] = (session.start_time || '00:00:00').split(':').map(Number);
    const [eh, em, es] = (session.end_time || '23:59:00').split(':').map(Number);

    const sessionStartDate = new Date(`${date}T${session.start_time}+05:30`);
    const sessionEndDate = new Date(`${date}T${session.end_time}+05:30`);
    sessionEndDate.setMinutes(sessionEndDate.getMinutes() + 2); // +2 min buffer

    const sessionStartISO = sessionStartDate.toISOString();
    const sessionEndISO = sessionEndDate.toISOString();

    const sessionDurationMin = (eh * 60 + em) - (sh * 60 + sm);

    // Determine if session is ongoing
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const isToday = date === today;
    const isOngoing = isToday && session.start_time <= currentTime && session.end_time > currentTime;

    // 3. Fetch wifi_snapshots in the session window (start_time to end_time + 2 min)
    const { data: snapshots } = await supabaseAdmin
      .from('wifi_snapshots')
      .select('id, iw_dump, captured_at')
      .gte('captured_at', sessionStartISO)
      .lte('captured_at', sessionEndISO)
      .order('captured_at', { ascending: true });

    // 4. Parse snapshots and build per-MAC timeline
    //    Each snapshot is a distinct "time interval" — count how many intervals each device appears in
    const macTimeline = {}; // mac -> [{snapshotId, time, signal, deviceName, ip}]
    // Ordered list of all snapshot IDs (for points calculation)
    const orderedSnapshotIds = (snapshots || []).map(s => s.id);

    (snapshots || []).forEach(snap => {
      let parsedClients = [];
      try {
        let dump = snap.iw_dump;
        if (typeof dump === 'string') dump = JSON.parse(dump);
        if (typeof dump === 'string') dump = JSON.parse(dump);
        parsedClients = Array.isArray(dump) ? dump : [];
      } catch (e) { parsedClients = []; }

      const snapTime = new Date(snap.captured_at);

      parsedClients.forEach(c => {
        if (!c.mac || c.mac.trim() === '') return;
        const mac = normalizeMac(c.mac);
        if (!isValidMac(mac)) return;

        const sig = parseInt(c.signal) || 0;

        // Reject devices with signal <= 2
        if (sig <= MIN_SIGNAL) return;

        if (!macTimeline[mac]) macTimeline[mac] = [];
        macTimeline[mac].push({
          snapshotId: snap.id,
          time: snapTime,
          signal: sig,
          deviceName: c.name || '',
          ip: c.ip || '',
          duration: c.duration || '',
        });
      });
    });

    // 5. Fetch all students with MAC addresses
    const { data: allStudents } = await supabaseAdmin
      .from('students')
      .select('id, enrollment_no, program_name, mac_address, mac_verified, users ( first_name, last_name, email )');

    // Build MAC -> student lookup
    const macToStudent = {};
    (allStudents || []).forEach(s => {
      if (s.mac_address) {
        macToStudent[normalizeMac(s.mac_address)] = s;
      }
    });

    // 6. Build student results: count distinct snapshots (pings) each device appears in
    const studentResults = [];
    const processedStudentIds = new Set();

    Object.entries(macTimeline).forEach(([mac, timeline]) => {
      const student = macToStudent[mac];
      if (!student) return; // skip unidentified devices
      if (processedStudentIds.has(student.id)) return;
      processedStudentIds.add(student.id);

      const name = `${student.users?.first_name || ''} ${student.users?.last_name || ''}`.trim();

      // Count distinct snapshots this device appeared in = total pings
      const uniqueSnapshots = new Set(timeline.map(t => t.snapshotId));
      const pingCount = uniqueSnapshots.size;

      const firstSeen = timeline[0].time;
      const lastSeen = timeline[timeline.length - 1].time;
      const durationMs = lastSeen.getTime() - firstSeen.getTime();
      const durationMinutes = Math.round(durationMs / 60000 * 10) / 10;
      const avgSignal = Math.round(timeline.reduce((a, t) => a + t.signal, 0) / timeline.length * 10) / 10;
      const latestSignal = timeline[timeline.length - 1].signal;

      // Calculate points using shared utility
      const { points, status: pointsStatus, breakdown } = calculatePoints(uniqueSnapshots, orderedSnapshotIds);

      // For ongoing sessions, keep 'partial' if student detected but not enough data yet
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
        deviceName: timeline[timeline.length - 1].deviceName || '',
        pings: timeline.map(t => ({
          time: t.time.toISOString(),
          signal: t.signal,
          snapshotId: t.snapshotId,
        })),
      });
    });

    // 7. Sort: present first, then partial, then absent
    const statusOrder = { present: 0, partial: 1, absent: 2 };
    studentResults.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

    // 8. Update attendance_records in DB — upsert present/absent for each detected student
    const upsertRecords = studentResults.map(s => ({
      session_id: sessionId,
      student_id: s.studentId,
      ping_count: s.pingCount,
      points: s.points,
      status: s.status,
      calculated_at: new Date().toISOString(),
    }));

    if (upsertRecords.length > 0) {
      const { error: upsertErr } = await supabaseAdmin
        .from('attendance_records')
        .upsert(upsertRecords, {
          onConflict: 'session_id,student_id',
          ignoreDuplicates: false,
        });

      if (upsertErr) {
        console.error('Attendance upsert error:', upsertErr);
        // Don't fail the request — still return results
      }
    }

    // Summary
    const presentCount = studentResults.filter(s => s.status === 'present').length;
    const partialCount = studentResults.filter(s => s.status === 'partial').length;
    const absentCount = studentResults.filter(s => s.status === 'absent').length;

    // Get last snapshot timestamp for sync
    const lastSnapshotTime = snapshots && snapshots.length > 0
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
        venueName: session.venues?.name || '',
        venueBuilding: session.venues?.building || '',
        durationMinutes: sessionDurationMin,
      },
      students: studentResults,
      summary: {
        total: studentResults.length,
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
