export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { calculatePoints } from '@/lib/attendance-points';
import { sendFeedbackAvailableEmail } from '@/lib/emailer';

/**
 * Server-side cron endpoint: processes attendance for all ongoing/recent sessions.
 * Called automatically every 6 minutes by the background worker.
 * No auth required — secured by CRON_SECRET header.
 */

const MIN_SIGNAL = 2;
const MIN_PINGS_PRESENT = 3;

const normalizeMac = (mac) => {
  if (!mac) return '';
  return mac.trim().toUpperCase().replace(/[-.\s]/g, ':').replace(/:+/g, ':').replace(/^:|:$/g, '');
};
const isValidMac = (mac) => /^([A-F0-9]{2}:){5}[A-F0-9]{2}$/.test(mac);

export async function GET(req) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || 'cipd-attendance-cron-2026';
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    // 1. Fetch all sessions for today
    const { data: sessions, error: sessErr } = await supabaseAdmin
      .from('sessions')
      .select('id, title, session_date, start_time, end_time, status')
      .eq('session_date', today)
      .order('start_time', { ascending: true });

    if (sessErr) {
      console.error('Cron: sessions fetch error:', sessErr);
      return NextResponse.json({ error: sessErr.message }, { status: 500 });
    }

    // Filter to ongoing + recently completed sessions (end_time within last 10 min)
    const tenMinAgo = new Date(now.getTime() - 10 * 60000);
    const tenMinAgoTime = `${String(tenMinAgo.getHours()).padStart(2, '0')}:${String(tenMinAgo.getMinutes()).padStart(2, '0')}:00`;

    const activeSessions = (sessions || []).filter(s => {
      const isOngoing = s.start_time <= currentTime && s.end_time > currentTime;
      const justEnded = s.end_time <= currentTime && s.end_time >= tenMinAgoTime;
      return isOngoing || justEnded;
    });

    if (activeSessions.length === 0) {
      // Still fetch latest snapshot for staleness detection
      const { data: latestSnap } = await supabaseAdmin
        .from('wifi_snapshots')
        .select('captured_at')
        .order('captured_at', { ascending: false })
        .limit(1)
        .single();

      return NextResponse.json({
        message: 'No active sessions to process',
        date: today,
        time: currentTime,
        sessionsProcessed: 0,
        latestSnapshotAt: latestSnap?.captured_at || null,
      });
    }

    // 2. Fetch all students with MAC addresses
    const { data: allStudents } = await supabaseAdmin
      .from('students')
      .select('id, enrollment_no, mac_address')
      .not('mac_address', 'is', null);

    const macToStudent = {};
    (allStudents || []).forEach(s => {
      if (s.mac_address) {
        macToStudent[normalizeMac(s.mac_address)] = s;
      }
    });

    // 3. Process each active session
    const results = [];

    for (const session of activeSessions) {
      const date = session.session_date;
      const isOngoing = session.start_time <= currentTime && session.end_time > currentTime;

      // Time window: start_time → end_time + 2 min
      const sessionStartDate = new Date(`${date}T${session.start_time}+05:30`);
      const sessionEndDate = new Date(`${date}T${session.end_time}+05:30`);
      sessionEndDate.setMinutes(sessionEndDate.getMinutes() + 2);

      // Fetch wifi_snapshots in window
      const { data: snapshots } = await supabaseAdmin
        .from('wifi_snapshots')
        .select('id, iw_dump, captured_at')
        .gte('captured_at', sessionStartDate.toISOString())
        .lte('captured_at', sessionEndDate.toISOString())
        .order('captured_at', { ascending: true });

      // Parse snapshots and build per-MAC timeline
      const macTimeline = {};
      // Ordered list of all snapshot IDs in session (for points calc)
      const orderedSnapshotIds = (snapshots || []).map(s => s.id);

      (snapshots || []).forEach(snap => {
        let clients = [];
        try {
          let dump = snap.iw_dump;
          if (typeof dump === 'string') dump = JSON.parse(dump);
          if (typeof dump === 'string') dump = JSON.parse(dump);
          clients = Array.isArray(dump) ? dump : [];
        } catch (e) { clients = []; }

        clients.forEach(c => {
          if (!c.mac || c.mac.trim() === '') return;
          const mac = normalizeMac(c.mac);
          if (!isValidMac(mac)) return;
          const sig = parseInt(c.signal) || 0;
          if (sig <= MIN_SIGNAL) return;

          if (!macTimeline[mac]) macTimeline[mac] = [];
          macTimeline[mac].push({ snapshotId: snap.id, time: new Date(snap.captured_at), signal: sig });
        });
      });

      // Build attendance records
      const attendanceRecords = [];
      const processedIds = new Set();

      Object.entries(macTimeline).forEach(([mac, timeline]) => {
        const student = macToStudent[mac];
        if (!student || processedIds.has(student.id)) return;
        processedIds.add(student.id);

        const uniqueSnapshots = new Set(timeline.map(t => t.snapshotId));
        const pingCount = uniqueSnapshots.size;
        const firstSeen = timeline[0].time;
        const lastSeen = timeline[timeline.length - 1].time;
        const durationMinutes = Math.round((lastSeen - firstSeen) / 60000 * 10) / 10;
        const avgSignal = Math.round(timeline.reduce((a, t) => a + t.signal, 0) / timeline.length * 10) / 10;

        // Calculate points
        const { points, status: pointsStatus, breakdown } = calculatePoints(uniqueSnapshots, orderedSnapshotIds);

        // For ongoing sessions, keep 'partial' if points calc says present but pings < 3
        let status = pointsStatus;
        if (isOngoing && pingCount > 0 && pingCount < MIN_PINGS_PRESENT && status !== 'absent') {
          status = 'partial';
        }

        attendanceRecords.push({
          session_id: session.id,
          student_id: student.id,
          ping_count: pingCount,
          points,
          status,
          calculated_at: now.toISOString(),
          first_seen_at: firstSeen.toISOString(),
          last_seen_at: lastSeen.toISOString(),
          duration_minutes: durationMinutes,
          avg_signal_strength: avgSignal,
        });
      });

      // Fetch existing overridden/penalized records to skip them
      const { data: existingOverrides } = await supabaseAdmin
        .from('attendance_records')
        .select('student_id')
        .eq('session_id', session.id)
        .or('admin_override.eq.true,penalty.eq.true');

      const overriddenIds = new Set((existingOverrides || []).map(r => r.student_id));

      // Upsert only non-overridden records
      const safeRecords = attendanceRecords.filter(r => !overriddenIds.has(r.student_id));

      if (safeRecords.length > 0) {
        const { error: upsertErr } = await supabaseAdmin
          .from('attendance_records')
          .upsert(safeRecords, {
            onConflict: 'session_id,student_id',
            ignoreDuplicates: false,
          });

        if (upsertErr) {
          console.error(`Cron: upsert error for session ${session.id}:`, upsertErr);
        }
      }

      const present = attendanceRecords.filter(r => r.status === 'present').length;
      const partial = attendanceRecords.filter(r => r.status === 'partial').length;

      results.push({
        sessionId: session.id,
        title: session.title,
        status: isOngoing ? 'ongoing' : 'just_ended',
        snapshotsAnalyzed: (snapshots || []).length,
        studentsProcessed: attendanceRecords.length,
        present,
        partial,
      });

      console.log(`Cron: Processed session "${session.title}" — ${present} present, ${partial} partial, ${(snapshots || []).length} snapshots`);

      // ── AUTO-ROLLOUT: when session just ended, notify attended students ──
      if (!isOngoing && session.status !== 'completed') {
        // Mark session as completed
        await supabaseAdmin
          .from('sessions')
          .update({ status: 'completed' })
          .eq('id', session.id);

        // Fire-and-forget: send feedback notifications
        (async () => {
          try {
            const presentStudentIds = attendanceRecords
              .filter(r => r.status === 'present' || r.status === 'partial')
              .map(r => r.student_id);

            if (presentStudentIds.length === 0) return;

            // Get session details for the email
            const { data: sessionDetail } = await supabaseAdmin
              .from('sessions')
              .select(`
                id, title, session_date, start_time, end_time, course_id,
                courses ( id, name ),
                faculty ( id, users ( first_name, last_name ) )
              `)
              .eq('id', session.id)
              .single();

            // Compute deadline (24h from end)
            const deadline = new Date(`${session.session_date}T${session.end_time}+05:30`);
            deadline.setHours(deadline.getHours() + 24);

            // Get student details
            const { data: students } = await supabaseAdmin
              .from('users')
              .select('id, first_name, last_name, email')
              .in('id', presentStudentIds)
              .eq('is_active', true);

            // Insert notifications + send emails
            const notifications = (students || []).map(s => ({
              recipient_id: s.id,
              type: 'feedback_available',
              title: `📝 Feedback: ${sessionDetail?.courses?.name || session.title}`,
              message: `Your feedback form for "${session.title}" is ready. Deadline: ${deadline.toLocaleString('en-IN')}. Submit now!`,
              course_id: sessionDetail?.course_id,
              session_id: session.id,
              is_read: false,
            }));

            if (notifications.length > 0) {
              await supabaseAdmin.from('notifications').insert(notifications);
            }

            // Send emails in parallel
            await Promise.allSettled(
              (students || []).map(async (student) => {
                try {
                  const name = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';
                  await sendFeedbackAvailableEmail(student.email, name, sessionDetail || session, deadline.toISOString());
                  console.log(`✉ Feedback email sent to ${student.email}`);
                } catch (emailErr) {
                  console.error(`Feedback email failed for ${student.email}:`, emailErr.message);
                }
              })
            );

            console.log(`Cron: Feedback rollout for "${session.title}" — ${notifications.length} students notified`);
          } catch (bgErr) {
            console.error('Feedback auto-rollout error:', bgErr.message);
          }
        })();
      }
    }

    // Fetch latest snapshot timestamp for staleness detection
    const { data: latestSnap } = await supabaseAdmin
      .from('wifi_snapshots')
      .select('captured_at')
      .order('captured_at', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      message: `Processed ${results.length} session(s)`,
      date: today,
      time: currentTime,
      sessionsProcessed: results.length,
      latestSnapshotAt: latestSnap?.captured_at || null,
      results,
    });
  } catch (err) {
    console.error('Cron: process-attendance error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
