export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const search = (searchParams.get('search') || '').trim();
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const timeFrom = searchParams.get('timeFrom') || '';
    const timeTo = searchParams.get('timeTo') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '100');
    const offset = (page - 1) * pageSize;
    const isSearch = search.length > 0;

    // Fetch students for MAC matching
    const { data: allStudents } = await supabaseAdmin
      .from('students')
      .select('id, enrollment_no, program_name, mac_address, users ( first_name, last_name, email )')
      .not('mac_address', 'is', null);

    const normalizeMac = (mac) => {
      if (!mac) return '';
      return mac.trim().toUpperCase().replace(/[-.\s]/g, ':').replace(/:+/g, ':').replace(/^:|:$/g, '');
    };

    const macToStudent = {};
    (allStudents || []).forEach(s => {
      if (s.mac_address) macToStudent[normalizeMac(s.mac_address)] = s;
    });

    // Total snapshot count for stats
    const { count: totalSnapshotCount } = await supabaseAdmin
      .from('wifi_snapshots')
      .select('id', { count: 'exact', head: true });

    // Helper: build base query with date filters
    const buildQuery = () => {
      let q = supabaseAdmin
        .from('wifi_snapshots')
        .select('id, captured_at, iw_dump, error')
        .order('captured_at', { ascending: false });

      if (dateFrom) {
        const startTs = timeFrom ? `${dateFrom}T${timeFrom}:00+05:30` : `${dateFrom}T00:00:00+05:30`;
        q = q.gte('captured_at', startTs);
      }
      if (dateTo) {
        const endTs = timeTo ? `${dateTo}T${timeTo}:59+05:30` : `${dateTo}T23:59:59+05:30`;
        q = q.lte('captured_at', endTs);
      }
      return q;
    };

    // Helper: parse snapshot clients into flat rows (only identified students)
    const parseClients = (snapshots) => {
      const logs = [];
      let identified = 0;
      (snapshots || []).forEach(snap => {
        let clients = [];
        try {
          let dump = snap.iw_dump;
          if (typeof dump === 'string') dump = JSON.parse(dump);
          if (typeof dump === 'string') dump = JSON.parse(dump);
          clients = Array.isArray(dump) ? dump : [];
        } catch (e) {
          clients = [];
        }

        clients.forEach(client => {
          if (!client.mac || !client.mac.trim()) return;
          const mac = normalizeMac(client.mac);
          const deviceName = client.name || '';
          if (deviceName === 'DESKTOP-T5FJ3IE') return;

          const student = macToStudent[mac];
          if (!student) return;

          identified++;
          logs.push({
            snapshot_id: snap.id,
            captured_at: snap.captured_at,
            mac_address: client.mac,
            signal: typeof client.signal === 'number' ? client.signal : (parseInt(String(client.signal)) || 0),
            device_name: deviceName,
            duration: client.duration || '',
            student_name: `${student.users?.first_name || ''} ${student.users?.last_name || ''}`.trim(),
            enrollment_no: student?.enrollment_no || '',
            program: student?.program_name || '',
          });
        });
      });
      return { logs, identified };
    };

    if (isSearch) {
      // SEARCH MODE: fetch ALL snapshots in batches, parse, filter, return all matches
      const BATCH = 1000;
      let allLogs = [];
      let batchOffset = 0;
      let snapshotsScanned = 0;
      let totalIdentified = 0;
      const s = search.toLowerCase();

      while (true) {
        const { data: batch, error: batchErr } = await buildQuery().range(batchOffset, batchOffset + BATCH - 1);
        if (batchErr) break;
        if (!batch || batch.length === 0) break;

        snapshotsScanned += batch.length;
        const { logs, identified } = parseClients(batch);
        totalIdentified += identified;

        // Filter by search term
        const matches = logs.filter(l =>
          (l.mac_address || '').toLowerCase().includes(s) ||
          (l.student_name || '').toLowerCase().includes(s) ||
          (l.enrollment_no || '').toLowerCase().includes(s) ||
          (l.device_name || '').toLowerCase().includes(s)
        );
        allLogs = allLogs.concat(matches);

        if (batch.length < BATCH) break; // no more data
        batchOffset += BATCH;
      }

      return NextResponse.json({
        logs: allLogs,
        page: 1,
        pageSize: allLogs.length,
        hasMore: false,
        stats: {
          totalSnapshotsInDB: totalSnapshotCount || 0,
          snapshotsLoaded: snapshotsScanned,
          totalClients: allLogs.length,
          identifiedCount: allLogs.length,
        },
        latestSnapshot: allLogs[0]?.captured_at || null,
      });
    } else {
      // BROWSE MODE: paginate 100 at a time
      const { data: snapshots, error } = await buildQuery().range(offset, offset + pageSize);

      if (error) {
        return NextResponse.json({ error: 'Failed to fetch wifi snapshots' }, { status: 500 });
      }

      const hasMore = (snapshots || []).length > pageSize;
      const pageSnapshots = hasMore ? snapshots.slice(0, pageSize) : (snapshots || []);
      const { logs, identified } = parseClients(pageSnapshots);

      return NextResponse.json({
        logs,
        page,
        pageSize,
        hasMore,
        stats: {
          totalSnapshotsInDB: totalSnapshotCount || 0,
          snapshotsLoaded: pageSnapshots.length,
          totalClients: logs.length,
          identifiedCount: identified,
        },
        latestSnapshot: pageSnapshots[0]?.captured_at || null,
      });
    }
  } catch (err) {
    console.error('Wi-Fi logs error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(handler, ['admin']);
