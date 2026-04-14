export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

/**
 * POST /api/admin/attendance/override
 * Body: { session_id, student_id, action: 'present' | 'absent' }
 * 
 * present → 0.5 points, status=present, admin_override=true
 * absent  → 0 points this session + ALL sessions ±1 week = 0 points, absent, penalty=true
 */
async function handler(req) {
  try {
    const body = await req.json();
    const { session_id, student_id, action } = body;

    if (!session_id || !student_id || !['present', 'absent'].includes(action)) {
      return NextResponse.json({ error: 'session_id, student_id, and action (present/absent) required' }, { status: 400 });
    }

    // Fetch session to get date and course
    const { data: session, error: sessErr } = await supabaseAdmin
      .from('sessions')
      .select('id, session_date, courses ( id, name )')
      .eq('id', session_id)
      .single();

    if (sessErr || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (action === 'present') {
      // Mark present with 0.5 points
      const { error } = await supabaseAdmin
        .from('attendance_records')
        .upsert({
          session_id,
          student_id,
          status: 'present',
          points: 0.5,
          admin_override: true,
          penalty: false,
          penalty_reason: null,
          ping_count: 0,
          calculated_at: new Date().toISOString(),
        }, { onConflict: 'session_id,student_id' });

      if (error) {
        console.error('Override present error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        message: 'Student marked present by admin',
        points: 0.5,
        action: 'present',
      });
    }

    if (action === 'absent') {
      // 1. Mark THIS session as absent with penalty
      const { error: thisErr } = await supabaseAdmin
        .from('attendance_records')
        .upsert({
          session_id,
          student_id,
          status: 'absent',
          points: 0,
          admin_override: true,
          penalty: true,
          penalty_reason: 'Faking attendance — marked absent by admin',
          ping_count: 0,
          calculated_at: new Date().toISOString(),
        }, { onConflict: 'session_id,student_id' });

      if (thisErr) {
        console.error('Override absent error:', thisErr);
        return NextResponse.json({ error: thisErr.message }, { status: 500 });
      }

      // 2. Find ALL sessions for this student ±1 week from session date
      const sessionDate = new Date(session.session_date + 'T00:00:00+05:30');
      const oneWeekBefore = new Date(sessionDate);
      oneWeekBefore.setDate(oneWeekBefore.getDate() - 7);
      const oneWeekAfter = new Date(sessionDate);
      oneWeekAfter.setDate(oneWeekAfter.getDate() + 7);

      const weekBeforeStr = oneWeekBefore.toISOString().split('T')[0];
      const weekAfterStr = oneWeekAfter.toISOString().split('T')[0];

      // Get all sessions in the ±1 week window (same course)
      const { data: penaltySessions } = await supabaseAdmin
        .from('sessions')
        .select('id, session_date, title')
        .eq('course_id', session.courses?.id)
        .gte('session_date', weekBeforeStr)
        .lte('session_date', weekAfterStr);

      // 3. Upsert penalty records for all those sessions
      const penaltyRecords = (penaltySessions || [])
        .filter(s => s.id !== session_id) // skip the already-handled one
        .map(s => ({
          session_id: s.id,
          student_id,
          status: 'absent',
          points: 0,
          admin_override: false,
          penalty: true,
          penalty_reason: `Penalty: faking attendance on ${session.session_date} (${session.courses?.name || 'course'})`,
          ping_count: 0,
          calculated_at: new Date().toISOString(),
        }));

      let penaltyCount = 0;
      if (penaltyRecords.length > 0) {
        const { error: penErr } = await supabaseAdmin
          .from('attendance_records')
          .upsert(penaltyRecords, { onConflict: 'session_id,student_id' });

        if (penErr) {
          console.error('Penalty upsert error:', penErr);
        } else {
          penaltyCount = penaltyRecords.length;
        }
      }

      return NextResponse.json({
        message: 'Student marked absent with faking penalty',
        points: 0,
        action: 'absent',
        penaltySessions: penaltyCount,
        penaltyRange: `${weekBeforeStr} to ${weekAfterStr}`,
      });
    }
  } catch (err) {
    console.error('Override error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withRole(handler, ['admin']);
