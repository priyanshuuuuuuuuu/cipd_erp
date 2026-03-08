import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');
    const date = searchParams.get('date');
    const search = searchParams.get('search');
    const venueFilter = searchParams.get('venue');
    const signalFilter = searchParams.get('signal');
    const limit = parseInt(searchParams.get('limit') || '100');

    let query = supabaseAdmin
      .from('attendance_ping_logs')
      .select(`
        id, device_hash, bssid, signal_strength, ping_time,
        session_id,
        sessions ( id, title, courses ( name ), venues ( name, building ) ),
        students ( id, enrollment_no, mac_address, users ( first_name, last_name ) )
      `)
      .order('ping_time', { ascending: false })
      .limit(limit);

    if (sessionId) query = query.eq('session_id', sessionId);

    const { data: logs, error } = await query;

    if (error) {
      console.error('Wi-Fi logs error:', error);
      return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
    }

    // Post-filter by date if specified
    let filtered = logs || [];
    if (date) {
      filtered = filtered.filter(l => l.ping_time && l.ping_time.startsWith(date));
    }

    // Filter by search term
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(l =>
        l.device_hash?.toLowerCase().includes(s) ||
        l.students?.enrollment_no?.toLowerCase().includes(s) ||
        l.students?.users?.first_name?.toLowerCase().includes(s) ||
        l.students?.users?.last_name?.toLowerCase().includes(s)
      );
    }

    // Filter by venue
    if (venueFilter && venueFilter !== 'all') {
      filtered = filtered.filter(l => l.sessions?.venues?.name === venueFilter);
    }

    // Filter by signal strength
    if (signalFilter && signalFilter !== 'all') {
      if (signalFilter === 'strong') filtered = filtered.filter(l => l.signal_strength >= -50);
      else if (signalFilter === 'medium') filtered = filtered.filter(l => l.signal_strength > -70 && l.signal_strength < -50);
      else if (signalFilter === 'weak') filtered = filtered.filter(l => l.signal_strength <= -70);
    }

    // Compute stats
    const uniqueDevices = new Set(filtered.map(l => l.device_hash)).size;
    const avgRssi = filtered.length > 0
      ? Math.round(filtered.reduce((a, l) => a + (l.signal_strength || 0), 0) / filtered.length)
      : 0;
    const weakPings = filtered.filter(l => (l.signal_strength || 0) < -70).length;

    // Get unique venues for filter dropdown
    const venues = [...new Set((logs || []).map(l => l.sessions?.venues?.name).filter(Boolean))];

    // Format output
    const formattedLogs = filtered.map(l => ({
      id: l.id,
      timestamp: l.ping_time,
      deviceHash: l.device_hash,
      studentId: l.students?.enrollment_no || '',
      studentName: `${l.students?.users?.first_name || ''} ${l.students?.users?.last_name || ''}`.trim(),
      bssid: l.bssid,
      rssi: l.signal_strength,
      venue: l.sessions?.venues?.name || '',
      session: l.sessions?.title || '—',
    }));

    return NextResponse.json({
      logs: formattedLogs,
      stats: {
        totalProbes: filtered.length,
        uniqueDevices,
        avgRssi,
        weakPings,
      },
      venues,
    });
  } catch (err) {
    console.error('Wi-Fi logs error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(handler, ['admin']);
