export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

// Robust MAC normalizer
const normalizeMac = (mac) => {
  if (!mac) return '';
  return mac.trim().toUpperCase().replace(/[-.\s]/g, ':').replace(/:+/g, ':').replace(/^:|:$/g, '');
};
const isValidMac = (mac) => /^([A-F0-9]{2}:){5}[A-F0-9]{2}$/.test(mac);

async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // Fetch sessions for the given date with course, faculty, venue info
    const { data: sessions, error: sessErr } = await supabaseAdmin
      .from('sessions')
      .select(`
        id, title, session_date, start_time, end_time, status,
        courses ( id, name ),
        faculty ( id, users ( first_name, last_name ) ),
        venues ( id, name, building, router_bssid )
      `)
      .eq('session_date', date)
      .order('start_time', { ascending: true });

    if (sessErr) {
      console.error('Sessions fetch error:', sessErr);
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
    }

    // Fetch all students with MAC addresses (for matching)
    const { data: allStudents } = await supabaseAdmin
      .from('students')
      .select('id, mac_address')
      .not('mac_address', 'is', null);

    const studentMacs = new Set(
      (allStudents || [])
        .map(s => normalizeMac(s.mac_address))
        .filter(mac => mac && isValidMac(mac))
    );

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
    const today = now.toISOString().split('T')[0];

    const enrichedSessions = await Promise.all((sessions || []).map(async (session) => {
      const isToday = date === today;
      const isOngoing = isToday && session.start_time <= currentTime && session.end_time > currentTime;
      const isCompleted = session.status === 'completed' || (!isOngoing && (date < today || (isToday && session.end_time <= currentTime)));

      // Build time window: start_time → end_time + 2 minutes
      const sessionStartDate = new Date(`${date}T${session.start_time}+05:30`);
      const sessionEndDate = new Date(`${date}T${session.end_time}+05:30`);
      sessionEndDate.setMinutes(sessionEndDate.getMinutes() + 2); // +2 min buffer

      // Get wifi_snapshots within the session time window
      const { data: snapshots } = await supabaseAdmin
        .from('wifi_snapshots')
        .select('iw_dump, captured_at')
        .gte('captured_at', sessionStartDate.toISOString())
        .lte('captured_at', sessionEndDate.toISOString())
        .order('captured_at', { ascending: true });

      // Count unique students detected with signal > 2
      const seenStudentMacs = new Set();

      (snapshots || []).forEach(snap => {
        let parsedClients = [];
        try {
          let dump = snap.iw_dump;
          if (typeof dump === 'string') dump = JSON.parse(dump);
          if (typeof dump === 'string') dump = JSON.parse(dump);
          parsedClients = Array.isArray(dump) ? dump : [];
        } catch (e) { parsedClients = []; }

        parsedClients.forEach(c => {
          if (!c.mac || c.mac.trim() === '') return;
          // Signal filter intentionally disabled — nmap devices have signal=null
          // which parses to 0 and were incorrectly excluded.

          const mac = normalizeMac(c.mac);
          if (!isValidMac(mac)) return;

          if (studentMacs.has(mac)) {
            seenStudentMacs.add(mac);
          }
        });
      });

      const facultyName = session.faculty?.users
        ? `${session.faculty.users.first_name || ''} ${session.faculty.users.last_name || ''}`.trim()
        : '';

      return {
        id: session.id,
        title: session.title,
        sessionDate: session.session_date,
        startTime: session.start_time,
        endTime: session.end_time,
        status: isOngoing ? 'ongoing' : isCompleted ? 'completed' : 'scheduled',
        courseName: session.courses?.name || '',
        courseId: session.courses?.id || null,
        facultyName,
        venueName: session.venues?.name || '',
        venueBuilding: session.venues?.building || '',
        detectedStudents: seenStudentMacs.size,
        snapshotCount: (snapshots || []).length,
      };
    }));

    return NextResponse.json({ sessions: enrichedSessions, date });
  } catch (err) {
    console.error('Sessions by date error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(handler, ['admin']);
