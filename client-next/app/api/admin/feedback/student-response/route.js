export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { feedbackResponses, feedbackQuestions, students, users } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';

async function getHandler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');
    const studentId = searchParams.get('student_id');

    if (!sessionId || !studentId) {
      return NextResponse.json({ error: 'session_id and student_id required' }, { status: 400 });
    }

    // Get all responses for this student + session, with question details
    const responses = await db
      .select({
        question_id: feedbackResponses.questionId,
        rating: feedbackResponses.rating,
        yes_no: feedbackResponses.yesNo,
        text_answer: feedbackResponses.textAnswer,
        submitted_at: feedbackResponses.submittedAt,
        question: feedbackQuestions.question,
        type: feedbackQuestions.type,
        category: feedbackQuestions.category,
      })
      .from(feedbackResponses)
      .leftJoin(feedbackQuestions, eq(feedbackResponses.questionId, feedbackQuestions.id))
      .where(and(
        eq(feedbackResponses.sessionId, sessionId),
        eq(feedbackResponses.studentId, studentId)
      ))
      .orderBy(feedbackResponses.questionId);

    // Get student info
    const [student] = await db
      .select({
        enrollment_no: students.enrollmentNo,
        first_name: users.firstName,
        last_name: users.lastName,
      })
      .from(students)
      .leftJoin(users, eq(students.userId, users.id))
      .where(eq(students.userId, studentId))
      .limit(1);

    const formattedResponses = (responses || []).map(r => ({
      question: r.question,
      type: r.type,
      category: r.category,
      answer: r.type === 'yes_no' ? (r.yes_no ? 'Yes' : 'No')
        : r.type === 'rating' ? `${r.rating}/5`
        : r.type === 'mcq' ? (r.text_answer || '—')
        : (r.text_answer || '—'),
      raw: { rating: r.rating, yes_no: r.yes_no, text_answer: r.text_answer },
      submitted_at: r.submitted_at,
    }));

    return NextResponse.json({
      student: {
        name: student ? `${student.first_name || ''} ${student.last_name || ''}`.trim() : 'Unknown',
        enrollmentNo: student?.enrollment_no || '',
      },
      responses: formattedResponses,
    });
  } catch (err) {
    console.error('Student response error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(getHandler, ['admin']);
