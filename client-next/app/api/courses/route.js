import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';

async function handler(req) {
  try {
    if (req.user.role === 'admin') {
      // Admin sees all courses
      const { data: courses, error } = await supabaseAdmin
        .from('courses')
        .select('id, name, description, created_at')
        .order('name', { ascending: true });

      if (error) throw error;
      return NextResponse.json({ courses: courses || [] });
    }

    // Student sees enrolled courses
    const { data: enrollments } = await supabaseAdmin
      .from('course_enrollments')
      .select(`
        enrolled_at,
        courses ( id, name, description, created_at )
      `)
      .eq('student_id', req.user.id);

    const courses = (enrollments || []).map(e => ({
      ...e.courses,
      enrolled_at: e.enrolled_at,
    }));

    return NextResponse.json({ courses });
  } catch (err) {
    console.error('Courses error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
