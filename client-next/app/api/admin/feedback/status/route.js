export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

async function handler(req) {
  try {
    // Get all courses
    const { data: courses } = await supabaseAdmin
      .from('courses')
      .select('id, name');

    if (!courses || courses.length === 0) {
      return NextResponse.json({ feedback_status: [] });
    }

    const statusList = [];

    for (const course of courses) {
      // Get total enrolled students for this course
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

      if (!sessions || sessions.length === 0 || !totalEnrolled) continue;

      const sessionIds = sessions.map(s => s.id);

      // Get all feedback responses for these sessions
      // Count unique (session_id, student_id) combinations — a student counts as 
      // "submitted" for a session if they submitted at least one feedback response
      const { data: feedbackSubmissions } = await supabaseAdmin
        .from('feedback_responses')
        .select('student_id, session_id')
        .in('session_id', sessionIds);

      // Unique session-student pairs who submitted feedback
      const submittedPairs = new Set(
        (feedbackSubmissions || []).map(f => `${f.session_id}::${f.student_id}`)
      );

      // Total expected = enrolled_students × completed_sessions 
      const expectedTotal = totalEnrolled * sessions.length;
      const submitted = submittedPairs.size;
      const pending = Math.max(0, expectedTotal - submitted);

      // Also collect which students are pending for each session (for reminders)
      const pendingDetails = [];
      
      // Get enrolled students for this course
      const { data: enrolledStudents } = await supabaseAdmin
        .from('course_enrollments')
        .select('student_id, students:student_id ( id, users:id ( first_name, last_name, email ) )')
        .eq('course_id', course.id);

      for (const session of sessions) {
        if (!enrolledStudents) continue;
        for (const enrollment of enrolledStudents) {
          const key = `${session.id}::${enrollment.student_id}`;
          if (!submittedPairs.has(key)) {
            pendingDetails.push({
              session_id: session.id,
              student_id: enrollment.student_id,
              student_name: enrollment.students?.users 
                ? `${enrollment.students.users.first_name || ''} ${enrollment.students.users.last_name || ''}`.trim()
                : 'Unknown',
              student_email: enrollment.students?.users?.email || '',
            });
          }
        }
      }

      statusList.push({
        course: course.name,
        course_id: course.id,
        total_enrolled: totalEnrolled,
        completed_sessions: sessions.length,
        total: expectedTotal,
        submitted,
        pending,
        pending_details: pendingDetails,
      });
    }

    return NextResponse.json({ feedback_status: statusList });
  } catch (err) {
    console.error('Admin feedback status error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(handler, ['admin']);
