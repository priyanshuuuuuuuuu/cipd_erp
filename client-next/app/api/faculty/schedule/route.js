export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';
import { getISTDateString } from '@/lib/ist-date';

async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const upcoming = searchParams.get('upcoming') === 'true';

    let query = supabaseAdmin
      .from('sessions')
      .select(`
        id, title, session_date, start_time, end_time, status, course_id,
        courses ( id, name ),
        venues ( id, name, building )
      `)
      .eq('faculty_id', req.user.id)
      .order('session_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (upcoming) {
      const today = getISTDateString(); // IST date
      query = query.gte('session_date', today).neq('status', 'cancelled');
    }

    const { data: sessions, error } = await query;

    if (error) {
      console.error('Faculty schedule error:', error);
      return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 });
    }

    const mapped = (sessions || []).map((s) => ({
      id: s.id,
      title: s.title || 'Untitled',
      course: s.courses?.name || 'Unknown',
      course_id: s.course_id,
      venue: s.venues?.name || 'TBA',
      date: s.session_date,
      time: s.start_time?.slice(0, 5),
      endTime: s.end_time?.slice(0, 5),
      status: s.status === 'scheduled' ? 'Scheduled' : s.status.charAt(0).toUpperCase() + s.status.slice(1),
    }));

    return NextResponse.json({ sessions: mapped });
  } catch (err) {
    console.error('Faculty schedule error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(handler, ['faculty']);
