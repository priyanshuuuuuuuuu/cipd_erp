export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  sessions,
  courses,
  faculty,
  users,
  venues,
  feedbackQuestions,
  feedbackResponses,
} from '@/drizzle/schema';
import { eq, ne, and, inArray, asc, desc } from 'drizzle-orm';
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

    const eligibleSessionIds = await getEligibleSessionIdsForStudent(db, studentId);

    if (eligibleSessionIds.length === 0) {
      const questions = await db
        .select({
          id: feedbackQuestions.id,
          question: feedbackQuestions.question,
          category: feedbackQuestions.category,
          type: feedbackQuestions.type,
          active: feedbackQuestions.active,
        })
        .from(feedbackQuestions)
        .where(eq(feedbackQuestions.active, true))
        .orderBy(asc(feedbackQuestions.createdAt));

      return NextResponse.json({
        forms: [],
        questions: questions || [],
        stats: { totalSubmitted: 0, totalPending: 0, totalExpired: 0, totalAttended: 0 },
      });
    }

    const eligibleSessions = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(
          inArray(sessions.id, eligibleSessionIds),
          ne(sessions.status, 'cancelled')
        )
      );

    const attendedSessionIds = eligibleSessions.map((s) => s.id);

    if (attendedSessionIds.length === 0) {
      const questions = await db
        .select({
          id: feedbackQuestions.id,
          question: feedbackQuestions.question,
          category: feedbackQuestions.category,
          type: feedbackQuestions.type,
          active: feedbackQuestions.active,
        })
        .from(feedbackQuestions)
        .where(eq(feedbackQuestions.active, true))
        .orderBy(asc(feedbackQuestions.createdAt));

      return NextResponse.json({
        forms: [],
        questions: questions || [],
        stats: { totalSubmitted: 0, totalPending: 0, totalExpired: 0, totalAttended: 0 },
      });
    }

    const submittedRows = await db
      .select({ session_id: feedbackResponses.sessionId })
      .from(feedbackResponses)
      .where(
        and(
          eq(feedbackResponses.studentId, studentId),
          inArray(feedbackResponses.sessionId, attendedSessionIds)
        )
      );

    const submittedSessionIds = [...new Set(submittedRows.map((f) => f.session_id).filter(Boolean))];
    const pendingSessionIds = attendedSessionIds.filter((id) => !submittedSessionIds.includes(id));

    let pendingForms = [];
    if (pendingSessionIds.length > 0) {
      const pendingSessionRows = await db
        .select({
          id: sessions.id,
          title: sessions.title,
          session_date: sessions.sessionDate,
          start_time: sessions.startTime,
          end_time: sessions.endTime,
          feedback_deadline: sessions.feedbackDeadline,
          status: sessions.status,
          course_id: courses.id,
          course_name: courses.name,
          faculty_id: faculty.id,
          faculty_first_name: users.firstName,
          faculty_last_name: users.lastName,
          venue_id: venues.id,
          venue_name: venues.name,
        })
        .from(sessions)
        .leftJoin(courses, eq(sessions.courseId, courses.id))
        .leftJoin(faculty, eq(sessions.facultyId, faculty.id))
        .leftJoin(users, eq(faculty.id, users.id))
        .leftJoin(venues, eq(sessions.venueId, venues.id))
        .where(
          and(
            inArray(sessions.id, pendingSessionIds),
            ne(sessions.status, 'cancelled')
          )
        )
        .orderBy(desc(sessions.sessionDate));

      pendingForms = pendingSessionRows.map((s) => {
        const deadline = getFeedbackDeadline(s);
        const expired = isFeedbackExpired(s);

        return {
          session_id: s.id,
          title: s.title,
          session_date: s.session_date,
          start_time: s.start_time,
          end_time: s.end_time,
          course: s.course_id ? { id: s.course_id, name: s.course_name } : null,
          faculty: s.faculty_id ? { id: s.faculty_id, users: { first_name: s.faculty_first_name, last_name: s.faculty_last_name } } : null,
          venue: s.venue_id ? { id: s.venue_id, name: s.venue_name } : null,
          deadline: deadline.toISOString(),
          expired,
          hoursLeft: getFeedbackHoursLeft(s),
          submitted: false,
        };
      });
    }

    let submittedForms = [];
    if (submittedSessionIds.length > 0) {
      const submittedSessionRows = await db
        .select({
          id: sessions.id,
          title: sessions.title,
          session_date: sessions.sessionDate,
          start_time: sessions.startTime,
          end_time: sessions.endTime,
          course_id: courses.id,
          course_name: courses.name,
          faculty_id: faculty.id,
          faculty_first_name: users.firstName,
          faculty_last_name: users.lastName,
        })
        .from(sessions)
        .leftJoin(courses, eq(sessions.courseId, courses.id))
        .leftJoin(faculty, eq(sessions.facultyId, faculty.id))
        .leftJoin(users, eq(faculty.id, users.id))
        .where(inArray(sessions.id, submittedSessionIds))
        .orderBy(desc(sessions.sessionDate))
        .limit(10);

      submittedForms = submittedSessionRows.map((s) => ({
        session_id: s.id,
        title: s.title,
        session_date: s.session_date,
        course: s.course_id ? { id: s.course_id, name: s.course_name } : null,
        faculty: s.faculty_id ? { id: s.faculty_id, users: { first_name: s.faculty_first_name, last_name: s.faculty_last_name } } : null,
        submitted: true,
      }));
    }

    const questions = await db
      .select({
        id: feedbackQuestions.id,
        question: feedbackQuestions.question,
        category: feedbackQuestions.category,
        type: feedbackQuestions.type,
        active: feedbackQuestions.active,
      })
      .from(feedbackQuestions)
      .where(eq(feedbackQuestions.active, true))
      .orderBy(asc(feedbackQuestions.createdAt));

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

