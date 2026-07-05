export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';

const normalizeMac = (mac) => {
  if (!mac) return '';
  return mac.trim().toUpperCase().replace(/[-.\s]/g, ':').replace(/:+/g, ':').replace(/^:|:$/g, '');
};

async function handler(req) {
  try {
    const studentId = req.user.id;

    // Get the student's MAC address
    const { data: student } = await supabaseAdmin
      .from('students')
      .select('mac_address')
      .eq('id', studentId)
      .single();

    if (!student?.mac_address) {
      return NextResponse.json({ present: false, lastUpdated: null, message: 'MAC address not registered' });
    }

    const studentMac = normalizeMac(student.mac_address);

    // Get the latest wifi snapshot
    const { data: snapshots } = await supabaseAdmin
      .schema('public').from('wifi_snapshots')
      .select('iw_dump, captured_at')
      .order('captured_at', { ascending: false })
      .limit(1);

    if (!snapshots || snapshots.length === 0) {
      return NextResponse.json({ present: false, lastUpdated: null, message: 'No WiFi data available' });
    }

    const snapshot = snapshots[0];
    let clients = [];
    try {
      let dump = snapshot.iw_dump;
      if (typeof dump === 'string') dump = JSON.parse(dump);
      if (typeof dump === 'string') dump = JSON.parse(dump);
      clients = Array.isArray(dump) ? dump : [];
    } catch (e) { clients = []; }

    // Check if student's MAC is in the snapshot
    const found = clients.find(c => {
      if (!c.mac || c.mac.trim() === '') return false;
      return normalizeMac(c.mac) === studentMac;
    });

    return NextResponse.json({
      present: !!found,
      signal: found ? (parseInt(found.signal) || 0) : 0,
      lastUpdated: snapshot.captured_at,
    });
  } catch (err) {
    console.error('Presence check error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
