export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { calculatePoints } from '@/lib/attendance-points';
import { rolloutFeedbackForSession } from '@/lib/feedback-rollout';

/**
 * Server-side cron endpoint: processes attendance for all ongoing/recent sessions.
 * Called automatically every 6 minutes by the background worker.
 * No auth required — secured by CRON_SECRET header.
 *
 * Two-pass strategy:
 *  Pass 1 - WiFi attendance processing for active/recently-ended sessions TODAY
 *  Pass 2 - Missed sessions sweep: any session (any date) that ended but is
 *            still not marked completed -> mark completed + roll out feedback.
 *            Makes the system self-healing even if the worker missed the window.
 */

let MIN_SIGNAL = 2;
const MIN_PINGS_PRESENT = 3;
let SCANNER_INTERVAL_MIN = 6;

const normalizeMac = (mac) => {
  if (!mac) return '';
  return mac.trim().toUpperCase().replace(/[-.\s]/g, ':').replace(/:+/g, ':').replace(/^:|:$/g, '');
};
const isValidMac = (mac) => /^([A-F0-9]{2}:){5}[A-F0-9]{2}$/.test(mac);

export async function GET(req) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: settings } = await supabaseAdmin
      .from('system_settings')
      .select('scanner_interval_minutes, min_signal, ping_interval, presence_threshold')
      .eq('id', 1)
      .single();

    SCANNER_INTERVAL_MIN = settings?.scanner_interval_minutes || settings?.ping_interval || 6;
    MIN_SIGNAL = settings?.min_signal ?? settings?.presence_threshold ?? 2;

    const now = new Date();
    // All session_date / start_time / end_time in DB are stored as IST values.
    // We must compare against IST, not UTC.
    const nowIST = new Date(now.getTime() + 5.5 * 60 * 60 * 1000); // shift to IST
    const today = nowIST.toISOString().split('T')[0];               // YYYY-MM-DD in IST
    const currentTime = `${String(nowIST.getHours()).padStart(2, '0')}:${String(nowIST.getMinutes()).padStart(2, '0')}:${String(nowIST.getSeconds()).padStart(2, '0')}`;

    // =========================================================================
    // PASS 1 - WiFi attendance processing (active / recently-ended TODAY)
    // =========================================================================

    const { data: sessions, error: sessErr } = await supabaseAdmin
      .from('sessions')
      .select('id, title, session_date, start_time, end_time, status')
      .eq('session_date', today)
      .order('start_time', { ascending: true });

    if (sessErr) {
      console.error('Cron: sessions fetch error:', sessErr);
      return NextResponse.json({ error: sessErr.message }, { status: 500 });
    }

    const tenMinAgo = new Date(now.getTime() - 10 * 60000);
    const tenMinAgoTime = `${String(tenMinAgo.getHours()).padStart(2, '0')}:${String(tenMinAgo.getMinutes()).padStart(2, '0')}:00`;

    const activeSessions = (sessions || []).filter(s => {
      const isOngoing = s.start_time <= currentTime && s.end_time > currentTime;
      const justEnded = s.end_time <= currentTime && s.end_time >= tenMinAgoTime;
      return isOngoing || justEnded;
    });

    const { data: allStudents } = await supabaseAdmin
      .from('students')
      .select('id, enrollment_no, mac_address')
      .not('mac_address', 'is', null);

    const macToStudent = {};
    (allStudents || []).forEach(s => {
      if (s.mac_address) macToStudent[normalizeMac(s.mac_address)] = s;
    });

    const results = [];

    for (const session of activeSessions) {
      const date = session.session_date;
      const isOngoing = session.start_time <= currentTime && session.end_time > currentTime;

      const sessionStartDate = new Date(`${date}T${session.start_time}+05:30`);
      const sessionEndDate = new Date(`${date}T${session.end_time}+05:30`);
      const sessionDurationMin = Math.round((sessionEndDate - sessionStartDate) / 60000);
      const expectedTotalSnapshots = Math.floor(sessionDurationMin / SCANNER_INTERVAL_MIN);
      sessionEndDate.setMinutes(sessionEndDate.getMinutes() + 2);

      const { data: snapshots } = await supabaseAdmin
        .from('wifi_snapshots')
        .select('id, iw_dump, captured_at')
        .gte('captured_at', sessionStartDate.toISOString())
        .lte('captured_at', sessionEndDate.toISOString())
        .order('captured_at', { ascending: true });

      const macTimeline = {};
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

        const { points, status: pointsStatus } = calculatePoints(uniqueSnapshots, orderedSnapshotIds, expectedTotalSnapshots);

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

      const { data: existingOverrides } = await supabaseAdmin
        .from('attendance_records')
        .select('student_id')
        .eq('session_id', session.id)
        .or('admin_override.eq.true,penalty.eq.true');

      const overriddenIds = new Set((existingOverrides || []).map(r => r.student_id));
      const safeRecords = attendanceRecords.filter(r => !overriddenIds.has(r.student_id));

      if (safeRecords.length > 0) {
        const { error: upsertErr } = await supabaseAdmin
          .from('attendance_records')
          .upsert(safeRecords, { onConflict: 'session_id,student_id', ignoreDuplicates: false });
        if (upsertErr) console.error(`Cron: upsert error for session ${session.id}:`, upsertErr);
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

      console.log(`Cron: Processed session "${session.title}" - ${present} present, ${partial} partial, ${(snapshots || []).length} snapshots`);

      if (!isOngoing && session.status !== 'completed') {
        await supabaseAdmin.from('sessions').update({ status: 'completed' }).eq('id', session.id);

        const presentStudentIds = attendanceRecords
          .filter(r => r.status === 'present' || r.status === 'partial')
          .map(r => r.student_id);

        rolloutFeedbackForSession(session.id, presentStudentIds.length > 0 ? presentStudentIds : null)
          .then(res => console.log(`Cron: Feedback for "${session.title}" - ${res.notified} notified, ${res.skipped} skipped`))
          .catch(err => console.error('Feedback auto-rollout error:', err.message));
      }
    }

    // =========================================================================
    // PASS 2 - Missed sessions sweep (self-healing, runs every cron cycle)
    //
    // Finds sessions from ANY date that ended but are still not 'completed'.
    // Marks them completed and fires feedback rollout automatically.
    // The rolloutFeedbackForSession helper deduplicates notifications so it is
    // completely safe to call even if partially triggered before.
    // =========================================================================

    const { data: missedSessions } = await supabaseAdmin
      .from('sessions')
      .select('id, title, session_date, start_time, end_time, status')
      .not('status', 'eq', 'completed')
      .not('status', 'eq', 'cancelled')
      .or(`session_date.lt.${today},and(session_date.eq.${today},end_time.lt.${currentTime})`);

    const activeSessionIds = new Set(activeSessions.map(s => s.id));
    const missed = (missedSessions || []).filter(s => !activeSessionIds.has(s.id));

    let missedCompletedCount = 0;

    if (missed.length > 0) {
      console.log(`Cron Pass 2: ${missed.length} overdue session(s) found - marking completed + rolling out feedback`);

      for (const session of missed) {
        const { error: updateErr } = await supabaseAdmin
          .from('sessions')
          .update({ status: 'completed' })
          .eq('id', session.id);

        if (updateErr) {
          console.error(`Cron: Failed to mark session ${session.id} completed:`, updateErr.message);
          continue;
        }

        rolloutFeedbackForSession(session.id, null)
          .then(res => {
            if (res.notified > 0) {
              console.log(`Cron [missed]: "${session.title}" (${session.session_date}) - ${res.notified} students notified`);
            }
          })
          .catch(err => console.error(`Cron [missed]: Rollout error for ${session.id}:`, err.message));

        missedCompletedCount++;
      }
    }

    const { data: latestSnap } = await supabaseAdmin
      .from('wifi_snapshots')
      .select('captured_at')
      .order('captured_at', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      message: `Processed ${results.length} active session(s), completed ${missedCompletedCount} missed session(s)`,
      date: today,
      time: currentTime,
      sessionsProcessed: results.length,
      missedSessionsCompleted: missedCompletedCount,
      latestSnapshotAt: latestSnap?.captured_at || null,
      results,
    });
  } catch (err) {
    console.error('Cron: process-attendance error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
