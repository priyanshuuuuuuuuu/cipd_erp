import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';

async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');

    // Default to current week
    const now = new Date();
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const start = startDate || weekStart.toISOString().split('T')[0];
    const end = endDate || weekEnd.toISOString().split('T')[0];

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
        venues ( id, name, building )
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
