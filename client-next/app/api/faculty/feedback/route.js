export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { feedbackResponses, feedbackQuestions, sessions, courses } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';

// Student feedback on the caller's own classes. Responses are anonymised: no student identity leaves this route.
async function handler(req) {
  try {
    const rows = await db
      .select({
        session_id: sessions.id, title: sessions.title, date: sessions.sessionDate, course_id: sessions.courseId, course_name: courses.name,
        student_id: feedbackResponses.studentId, rating: feedbackResponses.rating, text: feedbackResponses.textAnswer,
        question: feedbackQuestions.question, category: feedbackQuestions.category,
      })
      .from(feedbackResponses)
      .innerJoin(sessions, eq(feedbackResponses.sessionId, sessions.id))
      .leftJoin(courses, eq(sessions.courseId, courses.id))
      .leftJoin(feedbackQuestions, eq(feedbackResponses.questionId, feedbackQuestions.id))
      .where(eq(sessions.facultyId, req.user.id));

    const bySession = new Map();
    for (const r of rows) {
      if (!bySession.has(r.session_id)) {
        bySession.set(r.session_id, { session_id: r.session_id, title: r.title, date: r.date, course_id: r.course_id, course_name: r.course_name || 'Unknown', ratings: [], respondents: new Set(), comments: [], byQuestion: new Map() });
      }
      const s = bySession.get(r.session_id);
      s.respondents.add(r.student_id);
      if (r.rating != null) {
        s.ratings.push(r.rating);
        const q = r.question || 'Rating';
        const agg = s.byQuestion.get(q) || { question: q, sum: 0, n: 0 };
        agg.sum += r.rating; agg.n += 1; s.byQuestion.set(q, agg);
      }
      if (r.text && r.text.trim()) s.comments.push(r.text.trim());
    }

    const avg = (a) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 100) / 100 : null);
    const sessionsOut = [...bySession.values()].map((s) => ({
      session_id: s.session_id, title: s.title, date: s.date, course_id: s.course_id, course_name: s.course_name,
      avg_rating: avg(s.ratings), responses: s.respondents.size,
      questions: [...s.byQuestion.values()].map((q) => ({ question: q.question, avg: Math.round((q.sum / q.n) * 100) / 100 })),
      comments: s.comments,
    })).sort((a, b) => String(b.date).localeCompare(String(a.date)));

    const byModule = new Map();
    for (const s of sessionsOut) {
      const m = byModule.get(s.course_id) || { course_id: s.course_id, course_name: s.course_name, ratings: [], responses: 0, sessions: 0 };
      if (s.avg_rating != null) m.ratings.push(s.avg_rating);
      m.responses += s.responses; m.sessions += 1; byModule.set(s.course_id, m);
    }

    const all = sessionsOut.map((s) => s.avg_rating).filter((x) => x != null);
    return NextResponse.json({
      overall: { avg_rating: avg(all), sessions_rated: all.length, responses: sessionsOut.reduce((n, s) => n + s.responses, 0) },
      modules: [...byModule.values()].map((m) => ({ course_id: m.course_id, course_name: m.course_name, avg_rating: avg(m.ratings), responses: m.responses, sessions: m.sessions })),
      sessions: sessionsOut,
    });
  } catch (err) {
    console.error('Faculty feedback error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(handler, ['faculty']);
