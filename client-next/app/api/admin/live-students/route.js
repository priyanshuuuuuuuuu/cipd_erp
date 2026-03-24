export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

async function handler(req) {
  try {
    // 1. Get the latest wifi_snapshot entry
    const { data: snapshots, error: snapErr } = await supabaseAdmin
      .from('wifi_snapshots')
      .select('id, captured_at, iw_dump')
      .order('captured_at', { ascending: false })
      .limit(1);

    if (snapErr) {
      return NextResponse.json({ error: snapErr.message }, { status: 500 });
    }

    if (!snapshots || snapshots.length === 0) {
      return NextResponse.json({ students: [], unidentified: [], stats: { totalDevices: 0, identifiedStudents: 0, unidentifiedDevices: 0 }, lastSnapshot: null });
    }

    const snapshot = snapshots[0];
    // iw_dump may be stored as a JSON string (double-encoded) — parse it
    let clients = [];
    try {
      let dump = snapshot.iw_dump;
      if (typeof dump === 'string') dump = JSON.parse(dump);
      if (typeof dump === 'string') dump = JSON.parse(dump); // double-encoded
      clients = Array.isArray(dump) ? dump : [];
    } catch (e) {
      clients = [];
    }

    // 2. Get all clients with a MAC address from iw_dump
    const normalizeMac = (mac) => mac ? mac.toUpperCase().replace(/-/g, ':') : '';
    const validClients = clients.filter(c => c.mac && c.mac.trim() !== '');

    // 3. Fetch all students who have a mac_address
    const { data: allStudents } = await supabaseAdmin
      .from('students')
      .select('id, enrollment_no, mac_address, users ( first_name, last_name, email )')
      .not('mac_address', 'is', null);

    // 4. Build MAC -> student map
    const macToStudent = {};
    (allStudents || []).forEach(s => {
      if (s.mac_address) {
        macToStudent[normalizeMac(s.mac_address)] = s;
      }
    });

    // 5. Map clients to students
    const identified = [];
    const unidentified = [];

    validClients.forEach(client => {
      const mac = normalizeMac(client.mac);
      const student = macToStudent[mac];
      const signal = parseInt(client.signal) || 0;

      if (student) {
        identified.push({
          studentId: student.id,
          enrollmentNo: student.enrollment_no,
          name: `${student.users?.first_name || ''} ${student.users?.last_name || ''}`.trim(),
          email: student.users?.email || '',
          macAddress: mac,
          deviceName: client.name || '',
          signal,
          ip: client.ip || '',
          duration: client.duration || '',
        });
      } else {
        unidentified.push({
          macAddress: mac,
          deviceName: client.name || '',
          signal,
          ip: client.ip || '',
          duration: client.duration || '',
        });
      }
    });

    return NextResponse.json({
      students: identified,
      unidentified,
      stats: {
        totalDevices: validClients.length,
        identifiedStudents: identified.length,
        unidentifiedDevices: unidentified.length,
      },
      lastSnapshot: snapshot.captured_at,
    });
  } catch (err) {
    console.error('Live students error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withRole(handler, ['admin']);
