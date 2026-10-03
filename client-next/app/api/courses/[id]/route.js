import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { courses, courseEnrollments, sessions, faculty, users, venues } from '@/drizzle/schema';
import { eq, count, desc } from 'drizzle-orm';
import { withAuth } from '@/lib/middleware';

async function handler(req, { params }) {
  try {
    const { id } = params;

    const [course] = await db
      .select({
        id: courses.id,
        name: courses.name,
        description: courses.description,
        created_at: courses.createdAt,
      })
      .from(courses)
      .where(eq(courses.id, id))
      .limit(1);

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Get enrolled students count
    const [enrollResult] = await db
      .select({ count: count() })
      .from(courseEnrollments)
      .where(eq(courseEnrollments.courseId, id));

    const enrolledCount = Number(enrollResult?.count || 0);

    // Get sessions
    const sessionRows = await db
      .select({
        id: sessions.id,
        title: sessions.title,
        session_date: sessions.sessionDate,
        start_time: sessions.startTime,
        end_time: sessions.endTime,
        status: sessions.status,
        faculty_id: faculty.id,
        faculty_first_name: users.firstName,
        faculty_last_name: users.lastName,
        venue_id: venues.id,
        venue_name: venues.name,
      })
      .from(sessions)
      .leftJoin(faculty, eq(sessions.facultyId, faculty.id))
      .leftJoin(users, eq(faculty.id, users.id))
      .leftJoin(venues, eq(sessions.venueId, venues.id))
      .where(eq(sessions.courseId, id))
      .orderBy(desc(sessions.sessionDate))
      .limit(20);

    const formattedSessions = sessionRows.map(s => ({
      id: s.id,
      title: s.title,
      session_date: s.session_date,
      start_time: s.start_time,
      end_time: s.end_time,
      status: s.status,
      faculty: s.faculty_id ? { id: s.faculty_id, users: { first_name: s.faculty_first_name, last_name: s.faculty_last_name } } : null,
      venues: s.venue_id ? { id: s.venue_id, name: s.venue_name } : null,
    }));

    return NextResponse.json({
      course,
      enrolled_count: enrolledCount,
      sessions: formattedSessions,
    });
  } catch (err) {
    console.error('Course detail error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);

