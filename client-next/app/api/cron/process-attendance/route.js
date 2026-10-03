export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase'; // Retained for wifi_snapshots rule
import { db } from '@/lib/db';
import { sessions } from '@/drizzle/schema';
import { eq, and, ne, or, lt, asc } from 'drizzle-orm';
import { rolloutFeedbackForSession } from '@/lib/feedback-rollout';
import { processSessionAttendance } from '@/lib/process-session-attendance';
import { enqueueAttendanceSummaryMessages } from '@/lib/notification-stream';

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

    const activeSessionsList = await db
      .select({
        id: sessions.id,
        title: sessions.title,
        session_date: sessions.sessionDate,
        start_time: sessions.startTime,
        end_time: sessions.endTime,
        status: sessions.status,
        course_id: sessions.courseId,
      })
      .from(sessions)
      .where(eq(sessions.sessionDate, today))
      .orderBy(asc(sessions.startTime));

    const tenMinAgo = new Date(now.getTime() - 10 * 60000);
    const tenMinAgoTime = `${String(tenMinAgo.getHours()).padStart(2, '0')}:${String(tenMinAgo.getMinutes()).padStart(2, '0')}:00`;

    const activeSessions = (activeSessionsList || []).filter((s) => {
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
        await db
          .update(sessions)
          .set({ status: 'completed' })
          .where(eq(sessions.id, session.id));

        const presentStudentIds = result.records
          .filter((r) => r.status === 'present' || r.status === 'partial')
          .map((r) => r.student_id);

        try {
          const feedback = await rolloutFeedbackForSession(
            session.id,
            presentStudentIds.length > 0 ? presentStudentIds : null
          );
          console.log(
            'Cron: Feedback queued for "' + session.title + '" — ' + feedback.queued + ' email job(s)'
          );
        } catch (error) {
          console.error('Feedback auto-rollout error:', error.message);
        }

        try {
          const summary = await enqueueAttendanceSummaryMessages(session, result.records);
          console.log(
            'Cron: Attendance summary queued for "' + session.title + '" — ' + summary.queued + ' email job(s)'
          );
        } catch (error) {
          console.error('Attendance summary auto-rollout error:', error.message);
        }
      }
    }

    const missedSessions = await db
      .select({
        id: sessions.id,
        title: sessions.title,
        session_date: sessions.sessionDate,
        start_time: sessions.startTime,
        end_time: sessions.endTime,
        status: sessions.status,
        course_id: sessions.courseId,
      })
      .from(sessions)
      .where(
        and(
          ne(sessions.status, 'completed'),
          ne(sessions.status, 'cancelled'),
          or(
            lt(sessions.sessionDate, today),
            and(eq(sessions.sessionDate, today), lt(sessions.endTime, currentTime))
          )
        )
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
        let missedResult = null;
        try {
          missedResult = await processSessionAttendance(session, {
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

        try {
          await db
            .update(sessions)
            .set({ status: 'completed' })
            .where(eq(sessions.id, session.id));
        } catch (updateErr) {
          console.error(
            `Cron: Failed to mark session ${session.id} completed:`,
            updateErr.message
          );
          continue;
        }

        try {
          const feedback = await rolloutFeedbackForSession(session.id, null);
          if (feedback.queued > 0) {
            console.log(
              'Cron [missed]: "' + session.title + '" — ' + feedback.queued + ' email job(s) queued'
            );
          }
        } catch (error) {
          console.error('Cron [missed]: Rollout error for ' + session.id + ':', error.message);
        }

        if (missedResult && missedResult.records) {
          try {
            const summary = await enqueueAttendanceSummaryMessages(session, missedResult.records);
            if (summary.queued > 0) {
              console.log(
                'Cron [missed]: Attendance summary queued for "' + session.title + '" — ' + summary.queued + ' email job(s)'
              );
            }
          } catch (error) {
            console.error('Cron [missed]: Attendance summary rollout error for ' + session.id + ':', error.message);
          }
        }

        missedCompletedCount++;
      }
    }

    // DO NOT MIGRATE - using Supabase as per migration rule for wifi_snapshots
    const { data: latestSnap } = await supabaseAdmin
      .schema('public').from('wifi_snapshots')
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
