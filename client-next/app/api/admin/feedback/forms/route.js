export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

// GET — list all feedback forms (sessions with completed status) + stats
async function getHandler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status'); // active, expired, all

    // Get all completed sessions
    const { data: sessions } = await supabaseAdmin
      .from('sessions')
      .select(`
        id, title, session_date, start_time, end_time, feedback_deadline, status,
        courses ( id, name ),
        faculty ( id, users ( first_name, last_name ) )
      `)
      .eq('status', 'completed')
      .order('session_date', { ascending: false });

    // Get all feedback responses for stats
    const { data: allResponses } = await supabaseAdmin
      .from('feedback_responses')
      .select('session_id, student_id, rating');

    // Get enrollments per course
    const { data: enrollments } = await supabaseAdmin
      .from('course_enrollments')
      .select('course_id, student_id');

    const enrollmentMap = {};
    (enrollments || []).forEach(e => {
      enrollmentMap[e.course_id] = (enrollmentMap[e.course_id] || 0) + 1;
    });

    const now = new Date();

    const forms = (sessions || []).map(s => {
      // Compute deadline
      let deadline;
      if (s.feedback_deadline) {
        deadline = new Date(s.feedback_deadline);
      } else {
        deadline = new Date(`${s.session_date}T${s.end_time || '23:59:00'}+05:30`);
        deadline.setHours(deadline.getHours() + 24);
      }
      const expired = now > deadline;
      const hoursLeft = Math.max(0, Math.round((deadline - now) / 3600000 * 10) / 10);

      // Count submissions
      const sessionResponses = (allResponses || []).filter(r => r.session_id === s.id);
      const uniqueStudents = new Set(sessionResponses.map(r => r.student_id)).size;
      const enrolled = enrollmentMap[s.courses?.id] || 0;
      const ratings = sessionResponses.filter(r => r.rating != null).map(r => r.rating);
      const avgRating = ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : null;

      return {
        session_id: s.id,
        title: s.title,
        session_date: s.session_date,
        start_time: s.start_time,
        end_time: s.end_time,
        course: s.courses,
        faculty: s.faculty ? {
          name: s.faculty.users ? `${s.faculty.users.first_name} ${s.faculty.users.last_name}` : 'TBA'
        } : null,
        deadline: deadline.toISOString(),
        expired,
        hoursLeft,
        submissions: uniqueStudents,
        enrolled,
        avgRating,
        formStatus: expired ? 'expired' : 'active',
      };
    });

    // Filter by status if requested
    let filtered = forms;
    if (status === 'active') filtered = forms.filter(f => !f.expired);
    if (status === 'expired') filtered = forms.filter(f => f.expired);

    return NextResponse.json({
      forms: filtered,
      stats: {
        total: forms.length,
        active: forms.filter(f => !f.expired).length,
        expired: forms.filter(f => f.expired).length,
        totalSubmissions: new Set((allResponses || []).map(r => `${r.session_id}::${r.student_id}`)).size,
      },
    });
  } catch (err) {
    console.error('Admin feedback forms error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH — update feedback deadline for a session
async function patchHandler(req) {
  try {
    const { session_id, feedback_deadline } = await req.json();

    if (!session_id) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }

    const updates = {};
    if (feedback_deadline !== undefined) {
      updates.feedback_deadline = feedback_deadline ? new Date(feedback_deadline).toISOString() : null;
    }

    const { data, error } = await supabaseAdmin
      .from('sessions')
      .update(updates)
      .eq('id', session_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ session: data, message: 'Deadline updated' });
  } catch (err) {
    console.error('Update feedback deadline error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(getHandler, ['admin']);
export const PATCH = withRole(patchHandler, ['admin']);
