export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';
import { getFeedbackDeadline, isFeedbackExpired } from '@/lib/feedback-deadline';
import { isStudentEligibleForSessionFeedback } from '@/lib/feedback-eligibility';

async function handler(req) {
  try {
    const { session_id, responses } = await req.json();
    const studentId = req.user.id;

    if (!session_id || !responses || !Array.isArray(responses)) {
      return NextResponse.json({ error: 'session_id and responses array are required' }, { status: 400 });
    }

    const { data: session, error: sessionError } = await supabaseAdmin
      .from('sessions')
      .select('id, session_date, end_time, feedback_deadline, status')
      .eq('id', session_id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status === 'cancelled') {
      return NextResponse.json({ error: 'Feedback is not available for cancelled sessions' }, { status: 403 });
    }

    const eligible = await isStudentEligibleForSessionFeedback(supabaseAdmin, studentId, session_id);
    if (!eligible) {
      return NextResponse.json(
        { error: 'You are not eligible to submit feedback for this session. Only students marked present may submit.' },
        { status: 403 }
      );
    }

    if (isFeedbackExpired(session)) {
      return NextResponse.json(
        {
          error: 'Feedback deadline has passed',
          deadline: getFeedbackDeadline(session).toISOString(),
        },
        { status: 403 }
      );
    }

    const { count: existingCount, error: existingError } = await supabaseAdmin
      .from('feedback_responses')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', session_id)
      .eq('student_id', studentId);

    if (existingError) {
      console.error('Feedback duplicate check error:', existingError);
      return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
    }

    if (existingCount > 0) {
      return NextResponse.json(
        { error: 'Feedback has already been submitted for this session' },
        { status: 409 }
      );
    }

    const records = responses.map((r) => ({
      session_id,
      student_id: studentId,
      question_id: r.question_id,
      rating: r.rating || null,
      yes_no: r.yes_no !== undefined ? r.yes_no : null,
      text_answer: r.text_answer || null,
    }));

    const { error } = await supabaseAdmin.from('feedback_responses').insert(records);

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Feedback has already been submitted for this session' },
          { status: 409 }
        );
      }
      console.error('Feedback submit error:', error);
      return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Feedback submitted successfully' });
  } catch (err) {
    console.error('Feedback submit error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withAuth(handler);
