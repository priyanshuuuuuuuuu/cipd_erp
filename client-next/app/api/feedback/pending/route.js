export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';
import { getFeedbackDeadline, getFeedbackHoursLeft, isFeedbackExpired } from '@/lib/feedback-deadline';
import { getEligibleSessionIdsForStudent } from '@/lib/feedback-eligibility';

/**
 * Returns feedback forms for the logged-in student.
 * Eligibility: present/partial attendance only. Cancelled sessions excluded.
 */
async function handler(req) {
  try {
    const studentId = req.user.id;

    const eligibleSessionIds = await getEligibleSessionIdsForStudent(supabaseAdmin, studentId);

    if (eligibleSessionIds.length === 0) {
      const { data: questions } = await supabaseAdmin
        .from('feedback_questions')
        .select('id, question, category, type, active')
        .eq('active', true)
        .order('created_at', { ascending: true });

      return NextResponse.json({
        forms: [],
        questions: questions || [],
        stats: { totalSubmitted: 0, totalPending: 0, totalExpired: 0, totalAttended: 0 },
      });
    }

    const { data: eligibleSessions } = await supabaseAdmin
      .from('sessions')
      .select('id')
      .in('id', eligibleSessionIds)
      .neq('status', 'cancelled');

    const attendedSessionIds = (eligibleSessions || []).map((s) => s.id);

    if (attendedSessionIds.length === 0) {
      const { data: questions } = await supabaseAdmin
        .from('feedback_questions')
        .select('id, question, category, type, active')
        .eq('active', true)
        .order('created_at', { ascending: true });

      return NextResponse.json({
        forms: [],
        questions: questions || [],
        stats: { totalSubmitted: 0, totalPending: 0, totalExpired: 0, totalAttended: 0 },
      });
    }

    const { data: submittedRows } = await supabaseAdmin
      .from('feedback_responses')
      .select('session_id')
      .eq('student_id', studentId)
      .in('session_id', attendedSessionIds);

    const submittedSessionIds = [...new Set((submittedRows || []).map((f) => f.session_id))];
    const pendingSessionIds = attendedSessionIds.filter((id) => !submittedSessionIds.includes(id));

    let pendingForms = [];
    if (pendingSessionIds.length > 0) {
      const { data: sessions } = await supabaseAdmin
        .from('sessions')
        .select(`
          id, title, session_date, start_time, end_time, feedback_deadline, status,
          courses ( id, name ),
          faculty ( id, users ( first_name, last_name ) ),
          venues ( id, name )
        `)
        .in('id', pendingSessionIds)
        .neq('status', 'cancelled')
        .order('session_date', { ascending: false });

      pendingForms = (sessions || []).map((s) => {
        const deadline = getFeedbackDeadline(s);
        const expired = isFeedbackExpired(s);

        return {
          session_id: s.id,
          title: s.title,
          session_date: s.session_date,
          start_time: s.start_time,
          end_time: s.end_time,
          course: s.courses,
          faculty: s.faculty,
          venue: s.venues,
          deadline: deadline.toISOString(),
          expired,
          hoursLeft: getFeedbackHoursLeft(s),
          submitted: false,
        };
      });
    }

    let submittedForms = [];
    if (submittedSessionIds.length > 0) {
      const { data: sessions } = await supabaseAdmin
        .from('sessions')
        .select(`
          id, title, session_date, start_time, end_time,
          courses ( id, name ),
          faculty ( id, users ( first_name, last_name ) )
        `)
        .in('id', submittedSessionIds)
        .order('session_date', { ascending: false })
        .limit(10);

      submittedForms = (sessions || []).map((s) => ({
        session_id: s.id,
        title: s.title,
        session_date: s.session_date,
        course: s.courses,
        faculty: s.faculty,
        submitted: true,
      }));
    }

    const { data: questions } = await supabaseAdmin
      .from('feedback_questions')
      .select('id, question, category, type, active')
      .eq('active', true)
      .order('created_at', { ascending: true });

    const activePending = pendingForms.filter((f) => !f.expired).length;
    const expiredCount = pendingForms.filter((f) => f.expired).length;

    return NextResponse.json({
      forms: [...pendingForms, ...submittedForms],
      questions: questions || [],
      stats: {
        totalSubmitted: submittedSessionIds.length,
        totalPending: activePending,
        totalExpired: expiredCount,
        totalAttended: attendedSessionIds.length,
      },
    });
  } catch (err) {
    console.error('Feedback pending error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
