export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { courseEnrollments, sessions as sessionsTable, courses, faculty, users, venues, sessionTypes } from '@/drizzle/schema';
import { eq, and, inArray, gte, lte, ne, asc } from 'drizzle-orm';
import { withAuth } from '@/lib/middleware';
import { getISTWeekRange } from '@/lib/ist-date';

async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');

    // Default to current IST week (Monday–Sunday)
    const { start: weekStartStr, end: weekEndStr } = getISTWeekRange();

    const start = startDate || weekStartStr;
    const end = endDate || weekEndStr;

    // Get enrolled courses
    const enrollments = await db
      .select({ course_id: courseEnrollments.courseId })
      .from(courseEnrollments)
      .where(eq(courseEnrollments.studentId, req.user.id));

    const courseIds = (enrollments || []).map((e) => e.course_id);

    if (courseIds.length === 0) {
      return NextResponse.json({ sessions: [] });
    }

    const sessions = await db
      .select({
        id: sessionsTable.id,
        title: sessionsTable.title,
        session_date: sessionsTable.sessionDate,
        start_time: sessionsTable.startTime,
        end_time: sessionsTable.endTime,
        status: sessionsTable.status,
        courses: {
          id: courses.id,
          name: courses.name,
        },
        faculty: {
          id: faculty.id,
          users: {
            first_name: users.firstName,
            last_name: users.lastName,
          },
        },
        venues: {
          id: venues.id,
          name: venues.name,
          building: venues.building,
        },
        session_types: {
          id: sessionTypes.id,
          name: sessionTypes.name,
        },
      })
      .from(sessionsTable)
      .leftJoin(courses, eq(sessionsTable.courseId, courses.id))
      .leftJoin(faculty, eq(sessionsTable.facultyId, faculty.id))
      .leftJoin(users, eq(faculty.id, users.id))
      .leftJoin(venues, eq(sessionsTable.venueId, venues.id))
      .leftJoin(sessionTypes, eq(sessionsTable.sessionTypeId, sessionTypes.id))
      .where(
        and(
          inArray(sessionsTable.courseId, courseIds),
          gte(sessionsTable.sessionDate, start),
          lte(sessionsTable.sessionDate, end),
          ne(sessionsTable.status, 'cancelled')
        )
      )
      .orderBy(asc(sessionsTable.sessionDate), asc(sessionsTable.startTime));

    return NextResponse.json({ sessions: sessions || [] });
  } catch (err) {
    console.error('Schedule week error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
