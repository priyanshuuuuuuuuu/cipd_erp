export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';

async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const courseFilter = searchParams.get('course');
    const dateFilter = searchParams.get('date');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('attendance_records')
      .select(
        `
        id, status, points, ping_count, calculated_at,
        first_seen_at, last_seen_at, duration_minutes,
        sessions (
          id, title, session_date, start_time, end_time, status,
          courses ( id, name )
        )
      `,
        { count: 'exact' }
      )
      .eq('student_id', req.user.id)
      .eq('sessions.status', 'completed')
      .order('calculated_at', { ascending: false });

    if (dateFilter) {
      query = query.eq('sessions.session_date', dateFilter);
    }

    const { data: records, error, count } = await query.range(
      offset,
      offset + limit - 1
    );

    if (error) {
      console.error('Attendance sessions error:', JSON.stringify(error));
      return NextResponse.json(
        { error: 'Failed to fetch sessions', detail: error.message },
        { status: 500 }
      );
    }

    let filtered = records || [];

    if (courseFilter && courseFilter !== 'all') {
      filtered = filtered.filter(
        (r) =>
          r.sessions?.courses?.id === courseFilter ||
          r.sessions?.courses?.name === courseFilter
      );
    }

    filtered.sort((a, b) => {
      const da = a.sessions?.session_date || '';
      const db = b.sessions?.session_date || '';
      if (da !== db) return db.localeCompare(da);
      return (a.sessions?.start_time || '').localeCompare(
        b.sessions?.start_time || ''
      );
    });

    const sessions = filtered.map((r) => ({
      id: r.id,
      status: r.status,
      points: r.points,
      ping_count: r.ping_count,
      first_seen_at: r.first_seen_at,
      last_seen_at: r.last_seen_at,
      duration_minutes: r.duration_minutes,
      calculated_at: r.calculated_at,
      sessions: r.sessions
        ? {
            id: r.sessions.id,
            title: r.sessions.title,
            session_date: r.sessions.session_date,
            start_time: r.sessions.start_time,
            end_time: r.sessions.end_time,
            courses: r.sessions.courses,
          }
        : null,
    }));

    return NextResponse.json({
      sessions,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit),
      },
      source: 'attendance_records',
    });
  } catch (err) {
    console.error('Attendance sessions error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
