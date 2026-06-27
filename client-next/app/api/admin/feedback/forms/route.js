export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';
import { getFeedbackDeadline, getFeedbackHoursLeft, isFeedbackExpired } from '@/lib/feedback-deadline';
import { getAttendedCountBySession } from '@/lib/feedback-eligibility';

// GET — list all feedback forms (sessions with completed status) + stats
async function getHandler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status'); // active, expired, all

    const { data: sessions } = await supabaseAdmin
      .from('sessions')
      .select(`
        id, title, session_date, start_time, end_time, feedback_deadline, status,
        courses ( id, name ),
        faculty ( id, users ( first_name, last_name ) )
      `)
      .eq('status', 'completed')
      .order('session_date', { ascending: false });

    const sessionIds = (sessions || []).map((s) => s.id);

    const { data: allResponses } =
      sessionIds.length > 0
        ? await supabaseAdmin
            .from('feedback_responses')
            .select('session_id, student_id, rating')
            .in('session_id', sessionIds)
        : { data: [] };

    const attendedCountMap = await getAttendedCountBySession(
      supabaseAdmin,
      sessionIds.length > 0 ? sessionIds : null
    );

    const responsesBySession = {};
    (allResponses || []).forEach((r) => {
      if (!responsesBySession[r.session_id]) responsesBySession[r.session_id] = [];
      responsesBySession[r.session_id].push(r);
    });

    const forms = (sessions || []).map((s) => {
      const deadline = getFeedbackDeadline(s);
      const expired = isFeedbackExpired(s);

      const sessionResponses = responsesBySession[s.id] || [];
      const uniqueStudents = new Set(sessionResponses.map((r) => r.student_id)).size;
      const attended = attendedCountMap[s.id] || 0;
      const ratings = sessionResponses.filter((r) => r.rating != null).map((r) => r.rating);
      const avgRating =
        ratings.length > 0
          ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
          : null;

      return {
        session_id: s.id,
        title: s.title,
        session_date: s.session_date,
        start_time: s.start_time,
        end_time: s.end_time,
        course: s.courses,
        faculty: s.faculty
          ? {
              name: s.faculty.users
                ? `${s.faculty.users.first_name} ${s.faculty.users.last_name}`
                : 'TBA',
            }
          : null,
        deadline: deadline.toISOString(),
        expired,
        hoursLeft: getFeedbackHoursLeft(s),
        submissions: uniqueStudents,
        attended,
        enrolled: attended,
        avgRating,
        formStatus: expired ? 'expired' : 'active',
      };
    });

    let filtered = forms;
    if (status === 'active') filtered = forms.filter((f) => !f.expired);
    if (status === 'expired') filtered = forms.filter((f) => f.expired);

    return NextResponse.json({
      forms: filtered,
      stats: {
        total: forms.length,
        active: forms.filter((f) => !f.expired).length,
        expired: forms.filter((f) => f.expired).length,
        totalSubmissions: new Set((allResponses || []).map((r) => `${r.session_id}::${r.student_id}`)).size,
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
