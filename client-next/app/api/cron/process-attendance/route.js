export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getLatestSnapshot, isWifiSourceUnavailable } from '@/lib/wifi-snapshots';
import { forEachRunningCohort, sumField, cronHandlerRunner } from '@/lib/cohort-jobs';
import { db } from '@/lib/db';
import { sessions } from '@/drizzle/schema';
import { eq, and, ne, or, lt, lte, asc } from 'drizzle-orm';
import { rolloutFeedbackForSession } from '@/lib/feedback-rollout';
import { processSessionAttendance } from '@/lib/process-session-attendance';
import { enqueueAttendanceSummaryMessages } from '@/lib/notification-stream';
import { getISTNow } from '@/lib/ist-date';

/**
 * Server-side cron endpoint: processes attendance for all ongoing/recent sessions.
 * Called automatically every 6 minutes by the background worker.
 */

async function cronHandler() {
  try {
    const now = new Date();
    const campusTime = getISTNow(now).toISOString();
    const today = campusTime.slice(0, 10);
    const currentTime = campusTime.slice(11, 19);

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
      .where(and(eq(sessions.sessionDate, today), ne(sessions.status, 'cancelled')))
      .orderBy(asc(sessions.startTime));

    const tenMinAgo = now.getTime() - 10 * 60000;

    const activeSessions = (activeSessionsList || []).filter((s) => {
      const isOngoing =
        s.start_time <= currentTime && s.end_time > currentTime;
      const justEnded = s.end_time <= currentTime &&
        new Date(`${s.session_date}T${s.end_time}+05:30`).getTime() >= tenMinAgo;
      return isOngoing || justEnded;
    });

    const results = [];
    const skippedSessions = [];

    for (const session of activeSessions) {
      const isOngoing =
        session.start_time <= currentTime && session.end_time > currentTime;

      const result = await processSessionAttendance(session, {
        isOngoing,
        finalizeAbsent: !isOngoing,
        upsert: true,
        now,
      });

      if (result.skipped) {
        results.push({
          sessionId: session.id,
          title: session.title,
          status: 'skipped',
          reason: result.reason,
        });
        skippedSessions.push({ sessionId: session.id, title: session.title, reason: result.reason });
        continue; // leave the session unprocessed and not completed; next run retries
      }

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
        const [completed] = await db
          .update(sessions)
          .set({ status: 'completed' })
          .where(and(eq(sessions.id, session.id), eq(sessions.status, 'scheduled')))
          .returning({ id: sessions.id });
        if (!completed) continue;

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
            and(eq(sessions.sessionDate, today), lte(sessions.endTime, currentTime))
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
        let missedResult;
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
          skippedSessions.push({ sessionId: session.id, title: session.title, reason: 'attendance_processing_failed' });
          continue;
        }

        if (missedResult?.skipped) {
          skippedSessions.push({ sessionId: session.id, title: session.title, reason: missedResult.reason });
          continue; // do not complete a session we could not score
        }

        try {
          const [completed] = await db
            .update(sessions)
            .set({ status: 'completed' })
            .where(and(eq(sessions.id, session.id), eq(sessions.status, 'scheduled')))
            .returning({ id: sessions.id });
          if (!completed) continue;
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
    let latestSnap = null;
    try {
      latestSnap = await getLatestSnapshot();
    } catch (err) {
      if (!isWifiSourceUnavailable(err)) throw err;
    }

    return NextResponse.json({
      message: `Processed ${results.filter((r) => r.status !== 'skipped').length} active session(s), completed ${missedCompletedCount} missed session(s)`,
      date: today,
      time: currentTime,
      sessionsProcessed: results.filter((r) => r.status !== 'skipped').length,
      missedSessionsCompleted: missedCompletedCount,
      latestSnapshotAt: latestSnap?.captured_at || null,
      skippedSessions,
      results,
    });
  } catch (err) {
    console.error('Cron: process-attendance error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Cron jobs run once for every RUNNING cohort. Top-level totals are sums over cohorts, so
// scripts/attendance-worker.js (which reads sessionsProcessed) keeps working unchanged.
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret || (req.headers.get('x-cron-secret') !== secret && req.headers.get('authorization') !== `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const cohorts = await forEachRunningCohort(cronHandlerRunner(cronHandler));
  const sessionsProcessed = sumField(cohorts, 'sessionsProcessed');
  const missedSessionsCompleted = sumField(cohorts, 'missedSessionsCompleted');
  const skippedSessions = Object.entries(cohorts).flatMap(([schema, r]) =>
    (r?.skippedSessions || []).map((s) => ({ schema, ...s })));
  return NextResponse.json({
    message: `Processed ${sessionsProcessed} active session(s), completed ${missedSessionsCompleted} missed session(s) across ${Object.keys(cohorts).length} cohort(s)`,
    sessionsProcessed,
    missedSessionsCompleted,
    latestSnapshotAt: Object.values(cohorts).map((r) => r?.latestSnapshotAt).find(Boolean) || null,
    skippedSessions,
    cohorts,
  });
}
