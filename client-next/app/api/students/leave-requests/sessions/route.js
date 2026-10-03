export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { courseEnrollments, sessions as sessionsTable, courses, leaveRequests } from '@/drizzle/schema';
import { eq, and, inArray, ne, asc } from 'drizzle-orm';
import { withAuth } from '@/lib/middleware';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Sessions on a date for leave request multi-select */
async function getHandler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');

    if (!date || !DATE_RE.test(date)) {
      return NextResponse.json(
        { error: 'date query param required (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

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
        start_time: sessionsTable.startTime,
        end_time: sessionsTable.endTime,
        status: sessionsTable.status,
        courses: {
          name: courses.name,
        },
      })
      .from(sessionsTable)
      .leftJoin(courses, eq(sessionsTable.courseId, courses.id))
      .where(
        and(
          inArray(sessionsTable.courseId, courseIds),
          eq(sessionsTable.sessionDate, date),
          ne(sessionsTable.status, 'cancelled')
        )
      )
      .orderBy(asc(sessionsTable.startTime));

    const existingLeaves = await db
      .select({ session_id: leaveRequests.sessionId, status: leaveRequests.status })
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.studentId, req.user.id),
          eq(leaveRequests.leaveDate, date),
          inArray(leaveRequests.status, ['pending', 'approved'])
        )
      );

    const leaveMap = {};
    (existingLeaves || []).forEach((l) => {
      if (l.session_id) leaveMap[l.session_id] = l.status;
    });

    return NextResponse.json({
      sessions: (sessions || []).map((s) => ({
        id: s.id,
        title: s.title,
        startTime: s.start_time?.slice(0, 5),
        endTime: s.end_time?.slice(0, 5),
        courseName: s.courses?.name || '',
        leaveStatus: leaveMap[s.id] || null,
      })),
    });
  } catch (err) {
    console.error('Leave sessions GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
