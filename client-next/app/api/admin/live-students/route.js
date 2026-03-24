export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

async function handler(req) {
  try {
    // Get the latest wifi snapshot (within last 6 minutes)
    const sixMinAgo = new Date(Date.now() - 6 * 60 * 1000).toISOString();

    const { data: snapshots, error: snapErr } = await supabaseAdmin
      .from('wifi_snapshots')
      .select('id, captured_at, iw_dump')
      .gte('captured_at', sixMinAgo)
      .order('captured_at', { ascending: false })
      .limit(1);

    if (snapErr) {
      console.error('WiFi snapshots error:', snapErr);
      return NextResponse.json({ error: 'Failed to fetch snapshots' }, { status: 500 });
    }

    if (!snapshots || snapshots.length === 0) {
      return NextResponse.json({
        students: [],
        unidentified: [],
        stats: { totalDevices: 0, identifiedStudents: 0, unidentifiedDevices: 0, avgSignal: 0 },
        lastSnapshot: null,
      });
    }

    const snapshot = snapshots[0];
    const clients = Array.isArray(snapshot.iw_dump) ? snapshot.iw_dump : [];

    // Filter clients with signal >= 3 and valid MAC
    const validClients = clients.filter(c => {
      const sig = parseInt(c.signal);
      return c.mac && c.mac.trim() !== '' && !isNaN(sig) && sig >= 3;
    });

    // Normalize MAC addresses (router uses dashes, DB may use colons)
    const normalizeMac = (mac) => mac ? mac.toUpperCase().replace(/-/g, ':') : '';

    const clientMacs = validClients.map(c => normalizeMac(c.mac));

    // Fetch all students with MAC addresses
    const { data: allStudents, error: stuErr } = await supabaseAdmin
      .from('students')
      .select('id, enrollment_no, mac_address, users ( first_name, last_name, email )')
      .not('mac_address', 'is', null);

    if (stuErr) {
      console.error('Students fetch error:', stuErr);
      return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 });
    }

    // Build MAC -> student lookup
    const macToStudent = {};
    (allStudents || []).forEach(s => {
      if (s.mac_address) {
        macToStudent[normalizeMac(s.mac_address)] = s;
      }
    });

    const identifiedStudents = [];
    const unidentifiedDevices = [];

    validClients.forEach(client => {
      const mac = normalizeMac(client.mac);
      const student = macToStudent[mac];

      if (student) {
        identifiedStudents.push({
          studentId: student.id,
          enrollmentNo: student.enrollment_no,
          name: `${student.users?.first_name || ''} ${student.users?.last_name || ''}`.trim(),
          email: student.users?.email || '',
          macAddress: mac,
          deviceName: client.name || '',
          signal: parseInt(client.signal) || 0,
          ip: client.ip || '',
          duration: client.duration || '',
          download: client.download || '0',
          upload: client.upload || '0',
        });
      } else {
        unidentifiedDevices.push({
          macAddress: mac,
          deviceName: client.name || '',
          signal: parseInt(client.signal) || 0,
          ip: client.ip || '',
          duration: client.duration || '',
        });
      }
    });

    // Compute stats
    const allSignals = validClients.map(c => parseInt(c.signal) || 0);
    const avgSignal = allSignals.length > 0
      ? Math.round((allSignals.reduce((a, b) => a + b, 0) / allSignals.length) * 10) / 10
      : 0;

    return NextResponse.json({
      students: identifiedStudents,
      unidentified: unidentifiedDevices,
      stats: {
        totalDevices: validClients.length,
        identifiedStudents: identifiedStudents.length,
        unidentifiedDevices: unidentifiedDevices.length,
        avgSignal,
      },
      lastSnapshot: snapshot.captured_at,
    });
  } catch (err) {
    console.error('Live students error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(handler, ['admin']);
