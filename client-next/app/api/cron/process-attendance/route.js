export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { rolloutFeedbackForSession } from '@/lib/feedback-rollout';
import { processSessionAttendance } from '@/lib/process-session-attendance';

/**
 * Server-side cron endpoint: processes attendance for all ongoing/recent sessions.
 * Called automatically every 6 minutes by the background worker.
 */

export async function GET(req) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const nowIST = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    const today = nowIST.toISOString().split('T')[0];
    const currentTime = `${String(nowIST.getHours()).padStart(2, '0')}:${String(nowIST.getMinutes()).padStart(2, '0')}:${String(nowIST.getSeconds()).padStart(2, '0')}`;

    const { data: sessions, error: sessErr } = await supabaseAdmin
      .from('sessions')
      .select('id, title, session_date, start_time, end_time, status, course_id')
      .eq('session_date', today)
      .order('start_time', { ascending: true });

    if (sessErr) {
      console.error('Cron: sessions fetch error:', sessErr);
      return NextResponse.json({ error: sessErr.message }, { status: 500 });
    }

    const tenMinAgo = new Date(now.getTime() - 10 * 60000);
    const tenMinAgoTime = `${String(tenMinAgo.getHours()).padStart(2, '0')}:${String(tenMinAgo.getMinutes()).padStart(2, '0')}:00`;

    const activeSessions = (sessions || []).filter((s) => {
      const isOngoing =
        s.start_time <= currentTime && s.end_time > currentTime;
      const justEnded =
        s.end_time <= currentTime && s.end_time >= tenMinAgoTime;
      return isOngoing || justEnded;
    });

    const results = [];

    for (const session of activeSessions) {
      const isOngoing =
        session.start_time <= currentTime && session.end_time > currentTime;

      const result = await processSessionAttendance(session, {
        isOngoing,
        finalizeAbsent: !isOngoing,
        upsert: true,
        now,
      });

      results.push({
        sessionId: session.id,
        title: session.title,
        status: isOngoing ? 'ongoing' : 'just_ended',
        snapshotsAnalyzed: result.snapshotsAnalyzed,
        studentsProcessed: result.records.length,
        present: result.summary.present,
        partial: result.summary.partial,
        absent: result.summary.absent,
        leave: result.summary.leave,
      });

      console.log(
        `Cron: Processed "${session.title}" — ${result.summary.present} present, ${result.summary.partial} partial, ${result.summary.absent} absent, ${result.summary.leave} leave`
      );

      if (!isOngoing && session.status !== 'completed') {
        await supabaseAdmin
          .from('sessions')
          .update({ status: 'completed' })
          .eq('id', session.id);

        const presentStudentIds = result.records
          .filter((r) => r.status === 'present' || r.status === 'partial')
          .map((r) => r.student_id);

        rolloutFeedbackForSession(
          session.id,
          presentStudentIds.length > 0 ? presentStudentIds : null
        )
          .then((res) =>
            console.log(
              `Cron: Feedback for "${session.title}" — ${res.notified} notified`
            )
          )
          .catch((err) =>
            console.error('Feedback auto-rollout error:', err.message)
          );
      }
    }

    const { data: missedSessions } = await supabaseAdmin
      .from('sessions')
      .select('id, title, session_date, start_time, end_time, status, course_id')
      .not('status', 'eq', 'completed')
      .not('status', 'eq', 'cancelled')
      .or(
        `session_date.lt.${today},and(session_date.eq.${today},end_time.lt.${currentTime})`
      );

    const activeSessionIds = new Set(activeSessions.map((s) => s.id));
    const missed = (missedSessions || []).filter(
      (s) => !activeSessionIds.has(s.id)
    );

    let missedCompletedCount = 0;

    if (missed.length > 0) {
      console.log(
        `Cron Pass 2: ${missed.length} overdue session(s) — backfill + complete`
      );

      for (const session of missed) {
        try {
          await processSessionAttendance(session, {
            isOngoing: false,
            finalizeAbsent: true,
            upsert: true,
            now,
          });
        } catch (err) {
          console.error(
            `Cron Pass 2: attendance backfill failed for ${session.id}:`,
            err.message
          );
        }

        const { error: updateErr } = await supabaseAdmin
          .from('sessions')
          .update({ status: 'completed' })
          .eq('id', session.id);

        if (updateErr) {
          console.error(
            `Cron: Failed to mark session ${session.id} completed:`,
            updateErr.message
          );
          continue;
        }

        rolloutFeedbackForSession(session.id, null)
          .then((res) => {
            if (res.notified > 0) {
              console.log(
                `Cron [missed]: "${session.title}" — ${res.notified} notified`
              );
            }
          })
          .catch((err) =>
            console.error(`Cron [missed]: Rollout error for ${session.id}:`, err.message)
          );

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
