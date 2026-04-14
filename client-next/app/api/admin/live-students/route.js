export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

const STALE_THRESHOLD_MINUTES = 10; // consider data stale after 10 min

async function handler(req) {
  try {
    // 1. Fetch the latest 2 wifi_snapshot entries to compare timestamps
    const { data: snapshots, error: snapErr } = await supabaseAdmin
      .from('wifi_snapshots')
      .select('id, captured_at, iw_dump')
      .order('captured_at', { ascending: false })
      .limit(2);

    if (snapErr) {
      return NextResponse.json({ error: snapErr.message }, { status: 500 });
    }

    if (!snapshots || snapshots.length === 0) {
      return NextResponse.json({
        students: [],
        unidentified: [],
        stats: { totalDevices: 0, identifiedStudents: 0, unidentifiedDevices: 0 },
        lastSnapshot: null,
        lastUpdated: null,
        isStale: true,
        staleMessage: 'No Wi-Fi snapshots found. The scanner may not be running.',
      });
    }

    const latest = snapshots[0];
    const previous = snapshots.length > 1 ? snapshots[1] : null;

    // 2. Determine staleness
    const capturedAt = new Date(latest.captured_at);
    const now = new Date();
    const minutesAgo = Math.round((now - capturedAt) / 60000);
    const isStale = minutesAgo >= STALE_THRESHOLD_MINUTES;

    // Check if the latest snapshot is different from the previous one
    let isUnchanged = false;
    if (previous) {
      // Compare the iw_dump content — if identical the scanner may be stuck
      const latestDump = typeof latest.iw_dump === 'string' ? latest.iw_dump : JSON.stringify(latest.iw_dump);
      const prevDump = typeof previous.iw_dump === 'string' ? previous.iw_dump : JSON.stringify(previous.iw_dump);
      isUnchanged = latestDump === prevDump;
    }

    let staleMessage = null;
    if (isStale) {
      staleMessage = `Data is ${minutesAgo} minutes old. The Wi-Fi scanner may not be running or is unreachable.`;
    } else if (isUnchanged) {
      staleMessage = `Warning: The latest snapshot is identical to the previous one — scanner data may be frozen.`;
    }

    // 3. Parse iw_dump clients
    let clients = [];
    try {
      let dump = latest.iw_dump;
      if (typeof dump === 'string') dump = JSON.parse(dump);
      if (typeof dump === 'string') dump = JSON.parse(dump); // double-encoded
      clients = Array.isArray(dump) ? dump : [];
    } catch (e) {
      clients = [];
    }

    // 4. Normalize MACs — handles all real-world variations:
    //    Scanner: "EC-8E-B5-14-16-D7" (dashes, uppercase)
    //    Students DB: "c4:84:fc:06:e4:03" (colons, lowercase) or "A4:83:E7:2B:9F:01" (colons, uppercase)
    const normalizeMac = (mac) => {
      if (!mac) return '';
      return mac
        .trim()
        .toUpperCase()
        .replace(/[-.\s]/g, ':')   // replace dashes, dots, spaces with colons
        .replace(/:+/g, ':')       // collapse multiple colons
        .replace(/^:|:$/g, '');    // strip leading/trailing colons
    };
    const isValidMac = (mac) => /^([A-F0-9]{2}:){5}[A-F0-9]{2}$/.test(mac);
    const validClients = clients.filter(c => c.mac && c.mac.trim() !== '' && isValidMac(normalizeMac(c.mac)));

    // 5. Fetch all students who have a mac_address, join with users for name
    const { data: allStudents } = await supabaseAdmin
      .from('students')
      .select('id, enrollment_no, program_name, mac_address, mac_verified, users ( first_name, last_name, email )')
      .not('mac_address', 'is', null);

    // 6. Build MAC -> student map
    const macToStudent = {};
    (allStudents || []).forEach(s => {
      if (s.mac_address) {
        macToStudent[normalizeMac(s.mac_address)] = s;
      }
    });

    // 7. Map clients to identified students vs unidentified devices
    //    Rule: only include devices with signal > 3 (reject weak signals)
    const MIN_SIGNAL = 2;
    const identified = [];
    const unidentified = [];
    let rejectedCount = 0;

    validClients.forEach(client => {
      const mac = normalizeMac(client.mac);
      const student = macToStudent[mac];
      // Signal comes as string like "3 dBm" — extract the integer value directly
      const signal = parseInt(client.signal) || 0;

      // Reject devices with signal <= 3
      if (signal <= MIN_SIGNAL) {
        rejectedCount++;
        return;
      }

      if (student) {
        const firstName = student.users?.first_name || '';
        const lastName = student.users?.last_name || '';
        identified.push({
          studentId: student.id,
          enrollmentNo: student.enrollment_no || '',
          name: `${firstName} ${lastName}`.trim() || 'Unknown',
          firstName,
          lastName,
          email: student.users?.email || '',
          program: student.program_name || '',
          macAddress: mac,
          macVerified: student.mac_verified || false,
          deviceName: client.name || '',
          signal,
          ip: client.ip || '',
          duration: client.duration || '',
          download: client.download || '',
          upload: client.upload || '',
        });
      } else {
        unidentified.push({
          macAddress: mac,
          deviceName: client.name || '',
          signal,
          ip: client.ip || '',
          duration: client.duration || '',
          download: client.download || '',
          upload: client.upload || '',
        });
      }
    });

    // 8. Compute avg signal
    const allSignals = [...identified, ...unidentified].map(d => d.signal).filter(s => s > 0);
    const avgSignal = allSignals.length > 0 ? Math.round(allSignals.reduce((a, b) => a + b, 0) / allSignals.length) : 0;

    return NextResponse.json({
      students: identified,
      unidentified,
      stats: {
        totalDevices: validClients.length,
        identifiedStudents: identified.length,
        unidentifiedDevices: unidentified.length,
        rejectedWeakSignal: rejectedCount,
        avgSignal,
      },
      lastSnapshot: latest.captured_at,
      lastUpdated: latest.captured_at,
      snapshotId: latest.id,
      minutesAgo,
      isStale,
      isUnchanged,
      staleMessage,
    });
  } catch (err) {
    console.error('Live students error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withRole(handler, ['admin']);
