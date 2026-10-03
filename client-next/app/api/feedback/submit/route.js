export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessions, feedbackResponses } from '@/drizzle/schema';
import { eq, and, count } from 'drizzle-orm';
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

    const [session] = await db
      .select({
        id: sessions.id,
        session_date: sessions.sessionDate,
        end_time: sessions.endTime,
        feedback_deadline: sessions.feedbackDeadline,
        status: sessions.status,
      })
      .from(sessions)
      .where(eq(sessions.id, session_id))
      .limit(1);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status === 'cancelled') {
      return NextResponse.json({ error: 'Feedback is not available for cancelled sessions' }, { status: 403 });
    }

    const eligible = await isStudentEligibleForSessionFeedback(db, studentId, session_id);
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

    const [existingRes] = await db
      .select({ count: count() })
      .from(feedbackResponses)
      .where(
        and(
          eq(feedbackResponses.sessionId, session_id),
          eq(feedbackResponses.studentId, studentId)
        )
      );

    if (Number(existingRes?.count || 0) > 0) {
      return NextResponse.json(
        { error: 'Feedback has already been submitted for this session' },
        { status: 409 }
      );
    }

    const records = responses.map((r) => ({
      sessionId: session_id,
      studentId: studentId,
      questionId: r.question_id,
      rating: r.rating || null,
      yesNo: r.yes_no !== undefined ? r.yes_no : null,
      textAnswer: r.text_answer || null,
    }));

    try {
      await db.insert(feedbackResponses).values(records);
    } catch (insertErr) {
      if (insertErr?.code === '23505' || insertErr?.message?.includes('unique constraint')) {
        return NextResponse.json(
          { error: 'Feedback has already been submitted for this session' },
          { status: 409 }
        );
      }
      console.error('Feedback submit insert error:', insertErr);
      return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Feedback submitted successfully' });
  } catch (err) {
    console.error('Feedback submit error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withAuth(handler);

