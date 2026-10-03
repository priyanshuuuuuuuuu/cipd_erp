export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { feedbackResponses, feedbackQuestions, sessions, courses } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { withAuth } from '@/lib/middleware';

/**
 * GET /api/feedback/my-response?session_id=<uuid>
 * Returns the logged-in student's submitted answers for a specific session.
 * Uses the same FK hint pattern as the admin student-response route.
 */
async function handler(req) {
  try {
    const studentId = req.user.id;
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }

    const rows = await db
      .select({
        question_id: feedbackResponses.questionId,
        rating: feedbackResponses.rating,
        yes_no: feedbackResponses.yesNo,
        text_answer: feedbackResponses.textAnswer,
        fq_id: feedbackQuestions.id,
        fq_question: feedbackQuestions.question,
        fq_type: feedbackQuestions.type,
        fq_category: feedbackQuestions.category,
      })
      .from(feedbackResponses)
      .leftJoin(feedbackQuestions, eq(feedbackResponses.questionId, feedbackQuestions.id))
      .where(
        and(
          eq(feedbackResponses.studentId, studentId),
          eq(feedbackResponses.sessionId, sessionId)
        )
      )
      .orderBy(feedbackResponses.questionId);

    // Also fetch session info for display
    const [sessionRow] = await db
      .select({
        id: sessions.id,
        title: sessions.title,
        session_date: sessions.sessionDate,
        course_name: courses.name,
      })
      .from(sessions)
      .leftJoin(courses, eq(sessions.courseId, courses.id))
      .where(eq(sessions.id, sessionId))
      .limit(1);

    const session = sessionRow ? {
      id: sessionRow.id,
      title: sessionRow.title,
      session_date: sessionRow.session_date,
      courses: { name: sessionRow.course_name },
    } : null;

    // Format identically to admin route so frontend can reuse the same pattern
    const formatted = (rows || []).map(r => ({
      id: r.question_id,
      rating: r.rating,
      yes_no: r.yes_no,
      text_answer: r.text_answer,
      feedback_questions: r.fq_id ? { id: r.fq_id, question: r.fq_question, type: r.fq_type, category: r.fq_category } : null,
    }));

    return NextResponse.json({ responses: formatted, session });
  } catch (err) {
    console.error('my-response error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);

