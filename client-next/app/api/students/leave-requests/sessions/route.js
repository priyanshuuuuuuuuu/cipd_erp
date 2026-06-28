export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Sessions on a date for leave request multi-select */
async function getHandler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');

    if (!date || !DATE_RE.test(date)) {
      return NextResponse.json(
        { error: 'date query param required (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    const { data: enrollments } = await supabaseAdmin
      .from('course_enrollments')
      .select('course_id')
      .eq('student_id', req.user.id);

    const courseIds = (enrollments || []).map((e) => e.course_id);
    if (courseIds.length === 0) {
      return NextResponse.json({ sessions: [] });
    }

    const { data: sessions, error } = await supabaseAdmin
      .from('sessions')
      .select('id, title, start_time, end_time, status, courses ( name )')
      .in('course_id', courseIds)
      .eq('session_date', date)
      .neq('status', 'cancelled')
      .order('start_time', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'Failed to load sessions' }, { status: 500 });
    }

    const { data: existingLeaves } = await supabaseAdmin
      .from('leave_requests')
      .select('session_id, status')
      .eq('student_id', req.user.id)
      .eq('leave_date', date)
      .in('status', ['pending', 'approved']);

    const leaveMap = {};
    (existingLeaves || []).forEach((l) => {
      if (l.session_id) leaveMap[l.session_id] = l.status;
    });

    return NextResponse.json({
      sessions: (sessions || []).map((s) => ({
        id: s.id,
        title: s.title,
        startTime: s.start_time?.slice(0, 5),
        endTime: s.end_time?.slice(0, 5),
        courseName: s.courses?.name || '',
        leaveStatus: leaveMap[s.id] || null,
      })),
    });
  } catch (err) {
    console.error('Leave sessions GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
