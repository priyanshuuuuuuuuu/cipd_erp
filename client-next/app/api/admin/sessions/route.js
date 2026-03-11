export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

async function getHandler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const upcoming = searchParams.get('upcoming') === 'true';

    let query = supabaseAdmin
      .from('sessions')
      .select(`
        id, title, session_date, start_time, end_time, status, created_at,
        courses ( id, name ),
        faculty ( id, users ( first_name, last_name ) ),
        venues ( id, name, building )
      `)
      .order('session_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (status) query = query.eq('status', status);
    if (upcoming) {
      const today = new Date().toISOString().split('T')[0];
      query = query.gte('session_date', today).neq('status', 'cancelled');
    }

    const { data: sessions, error } = await query.limit(50);

    if (error) {
      console.error('Admin sessions error:', error);
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
    }

    // Get enrolled student counts per course
    const courseIds = [...new Set((sessions || []).map(s => s.courses?.id).filter(Boolean))];
    let enrollmentCounts = {};
    if (courseIds.length > 0) {
      for (const cid of courseIds) {
        const { count } = await supabaseAdmin
          .from('course_enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('course_id', cid);
        enrollmentCounts[cid] = count || 0;
      }
    }

    const sessionsWithCounts = (sessions || []).map(s => ({
      ...s,
      enrolled_students: enrollmentCounts[s.courses?.id] || 0,
    }));

    return NextResponse.json({ sessions: sessionsWithCounts });
  } catch (err) {
    console.error('Admin sessions error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function postHandler(req) {
  try {
    const { course_id, faculty_id, title, venue_id, session_date, start_time, end_time } = await req.json();

    if (!title || !session_date || !start_time || !end_time) {
      return NextResponse.json({ error: 'title, session_date, start_time, and end_time are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('sessions')
      .insert({
        course_id,
        faculty_id: faculty_id || null,
        title,
        venue_id: venue_id || null,
        session_date,
        start_time,
        end_time,
        status: 'scheduled',
        created_by: req.user.id,
      })
      .select()
      .single();

    if (error) {
      // Check for venue conflict
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Venue conflict: another session is already scheduled at this venue and time' }, { status: 409 });
      }
      console.error('Create session error:', error);
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }

    return NextResponse.json({ session: data }, { status: 201 });
  } catch (err) {
    console.error('Create session error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(getHandler, ['admin']);
export const POST = withRole(postHandler, ['admin']);
