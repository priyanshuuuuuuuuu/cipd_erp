export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessions, sessionSkills } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';
import { rolloutFeedbackForSession } from '@/lib/feedback-rollout';
import {
  fetchSessionForProcessing,
  processSessionAttendance,
} from '@/lib/process-session-attendance';

// PATCH /api/admin/sessions/[id]
async function handler(req, { params }) {
  try {
    const { id } = params;
    const body = await req.json();

    // ── Mode 1: status-only ────────────────────────────────────────────────
    if (Object.keys(body).length === 1 && body.status !== undefined) {
      const { status } = body;

      if (!['scheduled', 'completed', 'cancelled'].includes(status)) {
        return NextResponse.json(
          { error: 'Valid status required: scheduled, completed, cancelled' },
          { status: 400 }
        );
      }

      const [updated] = await db
        .update(sessions)
        .set({ status })
        .where(eq(sessions.id, id))
        .returning();

      if (!updated) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

      if (status === 'completed') {
        const session = await fetchSessionForProcessing(id);
        if (session) {
          try {
            await processSessionAttendance(session, {
              isOngoing: false,
              finalizeAbsent: true,
              upsert: true,
            });
          } catch (error) {
            console.error('Wi-Fi attendance on mark-complete:', error.message);
          }
        }

        try {
          await rolloutFeedbackForSession(id);
        } catch (error) {
          console.error('Feedback rollout error after admin mark-complete:', error.message);
        }
      }

      return NextResponse.json({ session: updated });
    }

    // ── Mode 2: full session edit ──────────────────────────────────────────
    const {
      title,
      course_id,
      faculty_id,
      venue_id,
      session_type_id,
      category_id,
      session_date,
      start_time,
      end_time,
      feedback_deadline,
      status,
      skill_ids,
    } = body;

    const updates = {};
    if (title !== undefined)           updates.title           = title?.trim() || null;
    if (course_id !== undefined)       updates.courseId        = course_id || null;
    if (faculty_id !== undefined)      updates.facultyId       = faculty_id || null;
    if (venue_id !== undefined)        updates.venueId         = venue_id || null;
    if (session_type_id !== undefined) updates.sessionTypeId  = session_type_id || null;
    if (category_id !== undefined)     updates.categoryId      = category_id || null;
    if (session_date !== undefined)    updates.sessionDate     = session_date || null;
    if (start_time !== undefined)      updates.startTime       = start_time || null;
    if (end_time !== undefined)        updates.endTime         = end_time || null;
    if (feedback_deadline !== undefined) {
      if (feedback_deadline === null || feedback_deadline === '') {
        updates.feedbackDeadline = null;
      } else {
        const parsedDeadline = new Date(feedback_deadline);
        if (Number.isNaN(parsedDeadline.getTime())) {
          return NextResponse.json({ error: 'Feedback deadline must be a valid date and time' }, { status: 400 });
        }
        updates.feedbackDeadline = parsedDeadline.toISOString();
      }
    }
    if (status !== undefined)          updates.status          = status;

    if (Object.keys(updates).length === 0 && skill_ids === undefined) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    if (updates.startTime && updates.endTime && updates.endTime <= updates.startTime) {
      return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 });
    }

    let sessionData = null;
    if (Object.keys(updates).length > 0) {
      try {
        const [updated] = await db
          .update(sessions)
          .set(updates)
          .where(eq(sessions.id, id))
          .returning();

        if (!updated) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        sessionData = updated;
      } catch (dbErr) {
        if (dbErr.code === '23505' || dbErr.message?.includes('unique constraint')) {
          return NextResponse.json(
            { error: 'Venue conflict: another session is already scheduled at this venue and time' },
            { status: 409 }
          );
        }
        console.error('Edit session error:', dbErr);
        return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
      }
    }

    // ── Sync session_skills ────────────────────────────────────────────────
    if (Array.isArray(skill_ids)) {
      const capped = skill_ids.slice(0, 4);

      try {
        await db
          .delete(sessionSkills)
          .where(eq(sessionSkills.sessionId, id));

        if (capped.length > 0) {
          const rows = capped.map(skill_id => ({ sessionId: id, skillId: skill_id }));
          await db.insert(sessionSkills).values(rows);
        }
      } catch (skillsErr) {
        console.error('Update session_skills error:', skillsErr);
        return NextResponse.json({ error: 'Failed to update skills' }, { status: 500 });
      }
    }

    return NextResponse.json({ session: sessionData, skill_ids: skill_ids ?? [] });
  } catch (err) {
    console.error('Session PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const PATCH = withRole(handler, ['admin']);

// DELETE /api/admin/sessions/[id]
async function deleteHandler(req, { params }) {
  try {
    const { id } = params;

    await db
      .delete(sessions)
      .where(eq(sessions.id, id));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Session DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const DELETE = withRole(deleteHandler, ['admin']);
