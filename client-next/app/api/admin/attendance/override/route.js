export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

/**
 * POST /api/admin/attendance/override
 * Body: { session_id, student_id, action: 'present' | 'absent' | 'leave' }
 *
 * present → 5 points, status=present, admin_override=true
 * leave   → 0 points, status=leave, admin_override=true
 * absent  → penalty cascade (faking attendance)
 */
async function handler(req) {
  try {
    const body = await req.json();
    const { session_id, student_id, action } = body;

    if (
      !session_id ||
      !student_id ||
      !['present', 'absent', 'leave'].includes(action)
    ) {
      return NextResponse.json(
        {
          error:
            'session_id, student_id, and action (present/absent/leave) required',
        },
        { status: 400 }
      );
    }

    const { data: session, error: sessErr } = await supabaseAdmin
      .from('sessions')
      .select('id, session_date, courses ( id, name )')
      .eq('id', session_id)
      .single();

    if (sessErr || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (action === 'present') {
      const { error } = await supabaseAdmin.from('attendance_records').upsert(
        {
          session_id,
          student_id,
          status: 'present',
          points: 5,
          admin_override: true,
          penalty: false,
          penalty_reason: null,
          ping_count: 0,
          calculated_at: new Date().toISOString(),
        },
        { onConflict: 'session_id,student_id' }
      );

      if (error) {
        console.error('Override present error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        message: 'Student marked present by admin',
        points: 5,
        action: 'present',
      });
    }

    if (action === 'leave') {
      const { error } = await supabaseAdmin.from('attendance_records').upsert(
        {
          session_id,
          student_id,
          status: 'leave',
          points: 0,
          admin_override: true,
          penalty: false,
          penalty_reason: null,
          ping_count: 0,
          calculated_at: new Date().toISOString(),
        },
        { onConflict: 'session_id,student_id' }
      );

      if (error) {
        console.error('Override leave error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        message: 'Student marked on approved leave by admin',
        points: 0,
        action: 'leave',
      });
    }

    if (action === 'absent') {
      const { error: thisErr } = await supabaseAdmin
        .from('attendance_records')
        .upsert(
          {
            session_id,
            student_id,
            status: 'absent',
            points: -2,
            admin_override: true,
            penalty: true,
            penalty_reason: 'Faking attendance — marked absent by admin',
            ping_count: 0,
            calculated_at: new Date().toISOString(),
          },
          { onConflict: 'session_id,student_id' }
        );

      if (thisErr) {
        console.error('Override absent error:', thisErr);
        return NextResponse.json({ error: thisErr.message }, { status: 500 });
      }

      const sessionDate = new Date(session.session_date + 'T00:00:00+05:30');
      const oneWeekBefore = new Date(sessionDate);
      oneWeekBefore.setDate(oneWeekBefore.getDate() - 7);
      const oneWeekAfter = new Date(sessionDate);
      oneWeekAfter.setDate(oneWeekAfter.getDate() + 7);

      const weekBeforeStr = oneWeekBefore.toISOString().split('T')[0];
      const weekAfterStr = oneWeekAfter.toISOString().split('T')[0];

      const { data: penaltySessions } = await supabaseAdmin
        .from('sessions')
        .select('id, session_date, title')
        .eq('course_id', session.courses?.id)
        .gte('session_date', weekBeforeStr)
        .lte('session_date', weekAfterStr);

      const penaltyRecords = (penaltySessions || [])
        .filter((s) => s.id !== session_id)
        .map((s) => ({
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

        if (!penErr) penaltyCount = penaltyRecords.length;
        else console.error('Penalty upsert error:', penErr);
      }

      return NextResponse.json({
        message: 'Student marked absent with faking penalty',
        points: -2,
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
