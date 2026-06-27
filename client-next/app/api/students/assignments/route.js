export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';

async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const courseIdFilter = searchParams.get('course_id');

    // Get enrolled courses
    const { data: enrollments } = await supabaseAdmin
      .from('course_enrollments')
      .select('course_id')
      .eq('student_id', req.user.id);

    let courseIds = (enrollments || []).map(e => e.course_id);

    if (courseIdFilter) {
      if (!courseIds.includes(courseIdFilter)) {
        return NextResponse.json({ assignments: [] });
      }
      courseIds = [courseIdFilter];
    }

    if (courseIds.length === 0) {
      return NextResponse.json({ assignments: [] });
    }

    // Get assignments for enrolled courses
    const { data: assignments, error } = await supabaseAdmin
      .from('assignments')
      .select(`
        id, title, description, due_date, created_at, total_marks, course_id,
        courses ( id, name ),
        faculty ( id, users ( first_name, last_name ) )
      `)
      .in('course_id', courseIds)
      .order('due_date', { ascending: true });

    if (error) {
      console.error('Assignments error:', error);
      return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 });
    }

    // Get student's submissions
    const assignmentIds = (assignments || []).map(a => a.id);
    let submissions = [];
    if (assignmentIds.length > 0) {
      const { data: subs } = await supabaseAdmin
        .from('assignment_submissions')
        .select('assignment_id, file_url, submitted_at, grade, feedback')
        .eq('student_id', req.user.id)
        .in('assignment_id', assignmentIds);
      submissions = subs || [];
    }

    // Merge assignments with submissions
    const merged = (assignments || []).map(a => {
      const sub = submissions.find(s => s.assignment_id === a.id);
      const submission_status = sub?.grade != null
        ? 'graded'
        : sub
          ? 'submitted'
          : 'pending';

      return {
        ...a,
        submission: sub || null,
        is_submitted: !!sub,
        is_overdue: !sub && new Date(a.due_date) < new Date(),
        submission_status,
        marks: sub?.grade ?? null,
        feedback: sub?.feedback ?? null,
      };
    });

    return NextResponse.json({ assignments: merged });
  } catch (err) {
    console.error('Assignments error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
