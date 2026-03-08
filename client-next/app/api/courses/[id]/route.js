import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';

async function handler(req, { params }) {
  try {
    const { id } = params;

    const { data: course, error } = await supabaseAdmin
      .from('courses')
      .select('id, name, description, created_at')
      .eq('id', id)
      .single();

    if (error || !course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Get enrolled students count
    const { count: enrolledCount } = await supabaseAdmin
      .from('course_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('course_id', id);

    // Get sessions
    const { data: sessions } = await supabaseAdmin
      .from('sessions')
      .select(`
        id, title, session_date, start_time, end_time, status,
        faculty ( id, users ( first_name, last_name ) ),
        venues ( id, name )
      `)
      .eq('course_id', id)
      .order('session_date', { ascending: false })
      .limit(20);

    return NextResponse.json({
      course,
      enrolled_count: enrolledCount || 0,
      sessions: sessions || [],
    });
  } catch (err) {
    console.error('Course detail error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
