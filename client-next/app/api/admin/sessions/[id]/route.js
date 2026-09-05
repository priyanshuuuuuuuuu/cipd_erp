export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';
import { rolloutFeedbackForSession } from '@/lib/feedback-rollout';
import {
  fetchSessionForProcessing,
  processSessionAttendance,
} from '@/lib/process-session-attendance';

// PATCH /api/admin/sessions/[id]
// Supports two modes:
//   1. Status-only update: { status: 'scheduled' | 'completed' | 'cancelled' }
//   2. Full session edit: { title, course_id, faculty_id, venue_id, session_type_id,
//                           session_date, start_time, end_time, skill_ids }
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

      const { data, error } = await supabaseAdmin
        .from('sessions')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Update session status error:', error);
        return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
      }
      if (!data) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

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

      return NextResponse.json({ session: data });
    }

    // ── Mode 2: full session edit ──────────────────────────────────────────
    const {
      title,
      course_id,
      faculty_id,
      venue_id,
      session_type_id,
      category_id,       // ← NEW: which category does this session fall under
      session_date,
      start_time,
      end_time,
      feedback_deadline,
      status,
      skill_ids,         // optional array of skill UUIDs
    } = body;

    // Build update payload — only include fields that were sent
    const updates = {};
    if (title !== undefined)           updates.title           = title?.trim() || null;
    if (course_id !== undefined)       updates.course_id       = course_id || null;
    if (faculty_id !== undefined)      updates.faculty_id      = faculty_id || null;
    if (venue_id !== undefined)        updates.venue_id        = venue_id || null;
    if (session_type_id !== undefined) updates.session_type_id = session_type_id || null;
    if (category_id !== undefined)     updates.category_id     = category_id || null;   // ← NEW
    if (session_date !== undefined)    updates.session_date    = session_date || null;
    if (start_time !== undefined)      updates.start_time      = start_time || null;
    if (end_time !== undefined)        updates.end_time        = end_time || null;
    if (feedback_deadline !== undefined) {
      if (feedback_deadline === null || feedback_deadline === '') {
        updates.feedback_deadline = null;
      } else {
        const parsedDeadline = new Date(feedback_deadline);
        if (Number.isNaN(parsedDeadline.getTime())) {
          return NextResponse.json({ error: 'Feedback deadline must be a valid date and time' }, { status: 400 });
        }
        updates.feedback_deadline = parsedDeadline.toISOString();
      }
    }
    if (status !== undefined)          updates.status          = status;

    if (Object.keys(updates).length === 0 && skill_ids === undefined) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // Validate time ordering if both provided
    if (updates.start_time && updates.end_time && updates.end_time <= updates.start_time) {
      return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 });
    }

    // Update session row (only if there are core field changes)
    let sessionData = null;
    if (Object.keys(updates).length > 0) {
      const { data, error } = await supabaseAdmin
        .from('sessions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return NextResponse.json(
            { error: 'Venue conflict: another session is already scheduled at this venue and time' },
            { status: 409 }
          );
        }
        console.error('Edit session error:', error);
        return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
      }
      if (!data) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      sessionData = data;
    }

    // ── Sync session_skills ────────────────────────────────────────────────
    if (Array.isArray(skill_ids)) {
      const capped = skill_ids.slice(0, 4); // enforce max 4

      // Delete existing mappings
      const { error: delErr } = await supabaseAdmin
        .from('session_skills')
        .delete()
        .eq('session_id', id);

      if (delErr) {
        console.error('Delete session_skills error:', delErr);
        return NextResponse.json({ error: 'Failed to update skills' }, { status: 500 });
      }

      // Insert new mappings (skip if empty)
      if (capped.length > 0) {
        const rows = capped.map(skill_id => ({ session_id: id, skill_id }));
        const { error: insErr } = await supabaseAdmin
          .from('session_skills')
          .insert(rows);

        if (insErr) {
          console.error('Insert session_skills error:', insErr);
          return NextResponse.json({ error: 'Failed to save skills' }, { status: 500 });
        }
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

    const { error } = await supabaseAdmin
      .from('sessions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Delete session error:', error);
      return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Session DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const DELETE = withRole(deleteHandler, ['admin']);
