export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';

async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const courseFilter = searchParams.get('course');
    const dateFilter = searchParams.get('date'); // YYYY-MM-DD
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('attendance_records')
      .select(`
        id, ping_count, status, points, calculated_at,
        sessions (
          id, title, session_date, start_time, end_time,
          courses ( id, name )
        )
      `, { count: 'exact' })
      .eq('student_id', req.user.id)
      .order('calculated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: records, error, count } = await query;

    if (error) {
      console.error('Attendance sessions error:', JSON.stringify(error));
      return NextResponse.json({ error: 'Failed to fetch sessions', detail: error.message }, { status: 500 });
    }

    // Post-filter by date and course
    let filtered = records || [];
    if (dateFilter) {
      filtered = filtered.filter(r => r.sessions?.session_date === dateFilter);
    }
    if (courseFilter && courseFilter !== 'all') {
      filtered = filtered.filter(r => r.sessions?.courses?.id === courseFilter || r.sessions?.courses?.name === courseFilter);
    }

    return NextResponse.json({
      sessions: filtered,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err) {
    console.error('Attendance sessions error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
