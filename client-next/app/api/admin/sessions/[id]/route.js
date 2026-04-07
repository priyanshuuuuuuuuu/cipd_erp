export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

// PATCH /api/admin/sessions/[id]
// Supports two modes:
//   1. Status-only update: { status: 'scheduled' | 'completed' | 'cancelled' }
//   2. Full session edit: { title, course_id, faculty_id, venue_id, session_type_id,
//                           session_date, start_time, end_time }
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

      // Trigger attendance calculation when marked completed
      if (status === 'completed') {
        const { error: calcError } = await supabaseAdmin.rpc('calculate_attendance', { p_session: id });
        if (calcError) console.error('Attendance calculation error:', calcError);
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
      session_date,
      start_time,
      end_time,
      status,
    } = body;

    // Build update payload — only include fields that were sent
    const updates = {};
    if (title !== undefined)           updates.title           = title?.trim() || null;
    if (course_id !== undefined)       updates.course_id       = course_id || null;
    if (faculty_id !== undefined)      updates.faculty_id      = faculty_id || null;
    if (venue_id !== undefined)        updates.venue_id        = venue_id || null;
    if (session_type_id !== undefined) updates.session_type_id = session_type_id || null;
    if (session_date !== undefined)    updates.session_date    = session_date || null;
    if (start_time !== undefined)      updates.start_time      = start_time || null;
    if (end_time !== undefined)        updates.end_time        = end_time || null;
    if (status !== undefined)          updates.status          = status;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // Validate time ordering if both provided
    if (updates.start_time && updates.end_time && updates.end_time <= updates.start_time) {
      return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 });
    }

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

    return NextResponse.json({ session: data });
  } catch (err) {
    console.error('Session PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const PATCH = withRole(handler, ['admin']);
