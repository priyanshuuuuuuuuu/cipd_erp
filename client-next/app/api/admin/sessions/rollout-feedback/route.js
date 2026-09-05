export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';
import { rolloutFeedbackForSession } from '@/lib/feedback-rollout';

/**
 * POST /api/admin/sessions/rollout-feedback
 * Body: { session_id: string }   — rollout for a single session
 *   OR: { all_completed: true }  — backfill all completed sessions missing notifications
 *
 * Admin-only. Safely skips students who already received a notification.
 */
async function handler(req) {
  try {
    const body = await req.json();

    // ── Single-session rollout ──────────────────────────────────────────────
    if (body.session_id) {
      const result = await rolloutFeedbackForSession(body.session_id);
      return NextResponse.json({
        message: `Feedback rollout complete for session ${body.session_id}`,
        ...result,
      });
    }

    // ── Backfill all completed sessions ────────────────────────────────────
    if (body.all_completed) {
      // Get all completed sessions
      const { data: sessions, error } = await supabaseAdmin
        .from('sessions')
        .select('id, title, session_date')
        .eq('status', 'completed')
        .order('session_date', { ascending: false });

      if (error) {
        return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
      }

      const summary = [];
      let totalNotified = 0;
      let totalQueued = 0;
      let totalAlreadyQueued = 0;
      let totalSkipped = 0;

      for (const session of sessions || []) {
        const result = await rolloutFeedbackForSession(session.id);
        totalNotified += result.notified;
        totalQueued += result.queued;
        totalAlreadyQueued += result.alreadyQueued || 0;
        totalSkipped += result.skipped;
        if (result.notified > 0 || result.queued > 0 || result.alreadyQueued > 0 || result.errors.length > 0) {
          summary.push({
            session_id: session.id,
            title: session.title,
            date: session.session_date,
            ...result,
          });
        }
      }

      return NextResponse.json({
        message: `Backfill complete: ${sessions?.length || 0} sessions processed`,
        totalNotified,
        totalQueued,
        totalAlreadyQueued,
        totalSkipped,
        sessionsWithActivity: summary,
      });
    }

    return NextResponse.json(
      { error: 'Provide either session_id or all_completed: true' },
      { status: 400 }
    );
  } catch (err) {
    console.error('Rollout feedback handler error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const POST = withRole(handler, ['admin']);
