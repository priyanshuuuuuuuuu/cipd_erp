export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }

    // Fetch the session details
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
    const sessionStart = `${date}T${session.start_time}`;
    const sessionEnd = `${date}T${session.end_time}`;

    // Determine if session is ongoing
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const isToday = date === today;
    const isOngoing = isToday && session.start_time <= currentTime && session.end_time > currentTime;

    // Session duration in minutes
    const [sh, sm] = session.start_time.split(':').map(Number);
    const [eh, em] = session.end_time.split(':').map(Number);
    const sessionDurationMin = (eh * 60 + em) - (sh * 60 + sm);

    // Get wifi_snapshots within the session time window
    const { data: snapshots } = await supabaseAdmin
      .from('wifi_snapshots')
      .select('iw_dump, captured_at')
      .gte('captured_at', sessionStart)
      .lte('captured_at', sessionEnd)
      .order('captured_at', { ascending: true });

    const normalizeMac = (mac) => mac ? mac.toUpperCase().replace(/-/g, ':') : '';

    // Build per-MAC timeline from wifi_snapshots: {mac -> [{time, signal, ...}]}
    // This is the "attendance_ping_logs" level detail — every sighting with signal
    const macTimeline = {};

    (snapshots || []).forEach(snap => {
      const clients = Array.isArray(snap.iw_dump) ? snap.iw_dump : [];
      const snapTime = new Date(snap.captured_at);

      clients.forEach(c => {
        const sig = parseInt(c.signal);
        if (!c.mac || c.mac.trim() === '') return;

        // Only include clients with signal >= 3
        if (isNaN(sig) || sig < 3) return;

        const mac = normalizeMac(c.mac);
        if (!macTimeline[mac]) macTimeline[mac] = [];
        macTimeline[mac].push({
          time: snapTime,
          signal: sig,
          duration: c.duration || '',
          deviceName: c.name || '',
          ip: c.ip || '',
        });
      });
    });

    // Fetch ALL students with MAC addresses (no enrollment filter — audit attendance)
    const { data: allStudents } = await supabaseAdmin
      .from('students')
      .select('id, enrollment_no, mac_address, users ( first_name, last_name )');

    // Build MAC -> student lookup
    const macToStudent = {};
    (allStudents || []).forEach(s => {
      if (s.mac_address) {
        macToStudent[normalizeMac(s.mac_address)] = s;
      }
    });

    // Build student results from ALL detected MACs that match a student
    const studentResults = [];
    const processedStudentIds = new Set();

    Object.entries(macTimeline).forEach(([mac, timeline]) => {
      const student = macToStudent[mac];
      if (!student) return; // skip unidentified devices
      if (processedStudentIds.has(student.id)) return;
      processedStudentIds.add(student.id);

      const name = `${student.users?.first_name || ''} ${student.users?.last_name || ''}`.trim();

      // Compute ping details (attendance_ping_logs level)
      const firstSeen = timeline[0].time;
      const lastSeen = timeline[timeline.length - 1].time;
      const durationMs = lastSeen.getTime() - firstSeen.getTime();
      const durationMinutes = Math.round(durationMs / 60000 * 10) / 10;
      const avgSignal = Math.round(timeline.reduce((a, t) => a + t.signal, 0) / timeline.length * 10) / 10;
      const latestSignal = timeline[timeline.length - 1].signal;

      // Remaining minutes for attendance (need 15 min)
      const remainingMinutes = isOngoing ? Math.max(0, Math.round((15 - durationMinutes) * 10) / 10) : 0;

      // attendance_records level: simple present/absent
      let status = 'absent';
      if (durationMinutes >= 15) {
        status = 'present';
      } else if (isOngoing) {
        status = 'partial'; // not yet 15 min but class still going
      }

      studentResults.push({
        studentId: student.id,
        enrollmentNo: student.enrollment_no || '',
        name,
        macAddress: mac,
        signal: latestSignal,
        avgSignal,
        firstSeen: firstSeen.toISOString(),
        lastSeen: lastSeen.toISOString(),
        durationMinutes,
        remainingMinutes,
        pingCount: timeline.length,
        status,
        deviceName: timeline[timeline.length - 1].deviceName || '',
        // Ping log details for each snapshot the student was seen in
        pings: timeline.map(t => ({
          time: t.time.toISOString(),
          signal: t.signal,
          deviceName: t.deviceName,
        })),
      });
    });

    // Sort: present first, then partial, then absent
    const statusOrder = { present: 0, partial: 1, absent: 2 };
    studentResults.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

    // Summary
    const presentCount = studentResults.filter(s => s.status === 'present').length;
    const partialCount = studentResults.filter(s => s.status === 'partial').length;
    const absentCount = studentResults.filter(s => s.status === 'absent').length;

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
    });
  } catch (err) {
    console.error('Session students error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(handler, ['admin']);
