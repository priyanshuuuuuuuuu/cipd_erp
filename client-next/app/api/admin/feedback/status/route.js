import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

async function handler(req) {
  try {
    // Get courses with feedback data
    const { data: courses } = await supabaseAdmin
      .from('courses')
      .select('id, name');

    if (!courses || courses.length === 0) {
      return NextResponse.json({ feedback_status: [] });
    }

    const statusList = [];

    for (const course of courses) {
      // Get total enrolled students
      const { count: totalEnrolled } = await supabaseAdmin
        .from('course_enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', course.id);

      // Get completed sessions for this course
      const { data: sessions } = await supabaseAdmin
        .from('sessions')
        .select('id')
        .eq('course_id', course.id)
        .eq('status', 'completed');

      if (!sessions || sessions.length === 0) continue;

      const sessionIds = sessions.map(s => s.id);

      // Get unique students who submitted feedback
      const { data: feedbackSubmissions } = await supabaseAdmin
        .from('feedback_responses')
        .select('student_id, session_id')
        .in('session_id', sessionIds);

      // Count unique session-student pairs
      const submitted = new Set((feedbackSubmissions || []).map(f => `${f.session_id}-${f.student_id}`)).size;
      const expectedTotal = (totalEnrolled || 0) * sessions.length;
      const pending = Math.max(0, expectedTotal - submitted);

      statusList.push({
        course: course.name,
        course_id: course.id,
        total: expectedTotal,
        submitted,
        pending,
      });
    }

    return NextResponse.json({ feedback_status: statusList });
  } catch (err) {
    console.error('Admin feedback status error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(handler, ['admin']);
