import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';

async function handler(req) {
  try {
    // Get assignments for student's enrolled courses
    const { data: enrollments } = await supabaseAdmin
      .from('course_enrollments')
      .select('course_id')
      .eq('student_id', req.user.id);

    const courseIds = (enrollments || []).map(e => e.course_id);

    if (courseIds.length === 0) {
      return NextResponse.json({ grades: [] });
    }

    // Get all submissions with grades
    const { data: submissions, error } = await supabaseAdmin
      .from('assignment_submissions')
      .select(`
        id, grade, feedback, submitted_at, file_url,
        assignments (
          id, title, description, due_date,
          courses ( id, name ),
          faculty ( id, users ( first_name, last_name ) )
        )
      `)
      .eq('student_id', req.user.id)
      .not('grade', 'is', null)
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('Grades error:', error);
      return NextResponse.json({ error: 'Failed to fetch grades' }, { status: 500 });
    }

    return NextResponse.json({ grades: submissions || [] });
  } catch (err) {
    console.error('Grades error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
