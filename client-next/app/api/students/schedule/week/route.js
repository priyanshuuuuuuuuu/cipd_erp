export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';
import { getISTWeekRange } from '@/lib/ist-date';

async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');

    // Default to current IST week (Monday–Sunday)
    const { start: weekStartStr, end: weekEndStr } = getISTWeekRange();

    const start = startDate || weekStartStr;
    const end = endDate || weekEndStr;

    // Get enrolled courses
    const { data: enrollments } = await supabaseAdmin
      .from('course_enrollments')
      .select('course_id')
      .eq('student_id', req.user.id);

    const courseIds = (enrollments || []).map(e => e.course_id);

    if (courseIds.length === 0) {
      return NextResponse.json({ sessions: [] });
    }

    const { data: sessions, error } = await supabaseAdmin
      .from('sessions')
      .select(`
        id, title, session_date, start_time, end_time, status,
        courses ( id, name ),
        faculty ( id, users ( first_name, last_name ) ),
        venues ( id, name, building ),
        session_types ( id, name )
      `)
      .in('course_id', courseIds)
      .gte('session_date', start)
      .lte('session_date', end)
      .neq('status', 'cancelled')
      .order('session_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Schedule week error:', error);
      return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 });
    }

    return NextResponse.json({ sessions: sessions || [] });
  } catch (err) {
    console.error('Schedule week error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
