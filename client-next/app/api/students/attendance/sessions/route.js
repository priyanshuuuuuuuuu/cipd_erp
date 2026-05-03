export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';

async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const courseFilter = searchParams.get('course');
    const dateFilter   = searchParams.get('date'); // YYYY-MM-DD
    const page  = parseInt(searchParams.get('page')  || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // Build query against student_attendance_marks joined to sessions
    let query = supabaseAdmin
      .from('student_attendance_marks')
      .select(`
        id, status, session_date, session_slot, source_domain, iso_week,
        sessions (
          id, title, session_date, start_time, end_time,
          courses ( id, name )
        )
      `, { count: 'exact' })
      .eq('student_id', req.user.id)
      .not('session_id', 'is', null) // only linked marks
      .order('session_date', { ascending: false })
      .order('session_slot', { ascending: true });

    if (dateFilter) {
      query = query.eq('session_date', dateFilter);
    }

    if (courseFilter && courseFilter !== 'all') {
      // Filter will be applied post-fetch via sessions.courses
    }

    const { data: marks, error, count } = await query
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Attendance sessions error:', JSON.stringify(error));
      return NextResponse.json({ error: 'Failed to fetch sessions', detail: error.message }, { status: 500 });
    }

    let filtered = marks || [];

    // Post-filter by course if needed
    if (courseFilter && courseFilter !== 'all') {
      filtered = filtered.filter(m =>
        m.sessions?.courses?.id   === courseFilter ||
        m.sessions?.courses?.name === courseFilter
      );
    }

    // Map to the shape the frontend expects (same as old attendance_records shape)
    const sessions = filtered.map(m => ({
      id:           m.id,
      status:       mapStatusForDisplay(m.status),
      points:       statusToPoints(m.status),
      ping_count:   null,
      calculated_at: m.session_date,
      sessions: m.sessions ? {
        id:           m.sessions.id,
        title:        m.sessions.title || `Session ${m.session_slot} — ${m.source_domain || ''}`,
        session_date: m.session_date,
        start_time:   m.sessions.start_time,
        end_time:     m.sessions.end_time,
        courses:      m.sessions.courses,
      } : null,
    }));

    return NextResponse.json({
      sessions,
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

/** Map our status codes to the display strings the frontend expects */
function mapStatusForDisplay(s) {
  switch (s) {
    case 'P':  return 'present';
    case 'PO': return 'present_online';
    case 'H':  return 'half';
    case 'A':  return 'absent';
    case 'L':  return 'leave';
    case 'C':  return 'present'; // C within limit = present
    default:   return s;
  }
}

function statusToPoints(s) {
  switch (s) {
    case 'P':  case 'PO': case 'C': return 1.0;
    case 'H':  return 0.5;
    case 'A':  return -1.0;
    default:   return 0.0;
  }
}

export const GET = withAuth(handler);
