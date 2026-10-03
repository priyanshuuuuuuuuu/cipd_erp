export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessions, feedbackResponses, courses, faculty, users } from '@/drizzle/schema';
import { eq, inArray, desc } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';
import { getFeedbackDeadline, getFeedbackHoursLeft, isFeedbackExpired } from '@/lib/feedback-deadline';
import { getAttendedCountBySession } from '@/lib/feedback-eligibility';

// GET — list all feedback forms (sessions with completed status) + stats
async function getHandler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status'); // active, expired, all

    // Fetch sessions
    const sessionsData = await db.query.sessions.findMany({
      columns: { id: true, title: true, sessionDate: true, startTime: true, endTime: true, feedbackDeadline: true, status: true },
      where: eq(sessions.status, 'completed'),
      with: {
        course: { columns: { id: true, name: true } },
        faculty: { columns: { id: true }, with: { user: { columns: { firstName: true, lastName: true } } } }
      },
      orderBy: [desc(sessions.sessionDate)]
    });

    const sessionIds = sessionsData.map(s => s.id);

    let allResponses = [];
    if (sessionIds.length > 0) {
      allResponses = await db.query.feedbackResponses.findMany({
        columns: { sessionId: true, studentId: true, rating: true },
        where: inArray(feedbackResponses.sessionId, sessionIds)
      });
    }

    const attendedCountMap = await getAttendedCountBySession(
      db,
      sessionIds.length > 0 ? sessionIds : null
    );

    const responsesBySession = {};
    (allResponses || []).forEach((r) => {
      if (!responsesBySession[r.sessionId]) responsesBySession[r.sessionId] = [];
      responsesBySession[r.sessionId].push(r);
    });

    const forms = sessionsData.map((s) => {
      const sessionObj = { session_date: s.sessionDate, end_time: s.endTime, feedback_deadline: s.feedbackDeadline };
      const deadline = getFeedbackDeadline(sessionObj);
      const expired = isFeedbackExpired(sessionObj);

      const sessionResponses = responsesBySession[s.id] || [];
      const uniqueStudents = new Set(sessionResponses.map((r) => r.studentId)).size;
      const attended = attendedCountMap[s.id] || 0;
      const ratings = sessionResponses.filter((r) => r.rating != null).map((r) => r.rating);
      const avgRating =
        ratings.length > 0
          ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
          : null;

      return {
        session_id: s.id,
        title: s.title,
        session_date: s.sessionDate,
        start_time: s.startTime,
        end_time: s.endTime,
        course: s.course,
        faculty: s.faculty
          ? {
              name: s.faculty.user
                ? `${s.faculty.user.firstName} ${s.faculty.user.lastName}`
                : 'TBA',
            }
          : null,
        deadline: deadline.toISOString(),
        expired,
        hoursLeft: getFeedbackHoursLeft(sessionObj),
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
        totalSubmissions: new Set((allResponses || []).map((r) => `${r.sessionId}::${r.studentId}`)).size,
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
      updates.feedbackDeadline = feedback_deadline ? new Date(feedback_deadline).toISOString() : null;
    }

    const [data] = await db.update(sessions)
      .set(updates)
      .where(eq(sessions.id, session_id))
      .returning();

    return NextResponse.json({ session: data, message: 'Deadline updated' });
  } catch (err) {
    console.error('Update feedback deadline error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(getHandler, ['admin']);
export const PATCH = withRole(patchHandler, ['admin']);
