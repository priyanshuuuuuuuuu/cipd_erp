export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessions, courses, faculty, users, venues, sessionTypes } from '@/drizzle/schema';
import { eq, and, gte, lte, asc } from 'drizzle-orm';
import { withAuth } from '@/lib/middleware';
import { loadSessionFaculty, toFacultyRef, toFacultyRefs } from '@/lib/session-faculty';

async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    if (!start || !end) {
      return NextResponse.json({ error: 'start and end date params are required' }, { status: 400 });
    }

    const rows = await db
      .select({
        id: sessions.id,
        title: sessions.title,
        session_date: sessions.sessionDate,
        start_time: sessions.startTime,
        end_time: sessions.endTime,
        status: sessions.status,
        course_id: courses.id,
        course_name: courses.name,
        venue_id: venues.id,
        venue_name: venues.name,
        venue_building: venues.building,
        session_type_id: sessionTypes.id,
        session_type_name: sessionTypes.name,
      })
      .from(sessions)
      .leftJoin(courses, eq(sessions.courseId, courses.id))
      .leftJoin(venues, eq(sessions.venueId, venues.id))
      .leftJoin(sessionTypes, eq(sessions.sessionTypeId, sessionTypes.id))
      .where(
        and(
          gte(sessions.sessionDate, start),
          lte(sessions.sessionDate, end)
        )
      )
      .orderBy(asc(sessions.sessionDate), asc(sessions.startTime));

    const facultyBySession = await loadSessionFaculty(rows.map(r => r.id));
    const formatted = rows.map(r => ({
      id: r.id,
      title: r.title,
      session_date: r.session_date,
      start_time: r.start_time,
      end_time: r.end_time,
      status: r.status,
      courses: r.course_id ? { id: r.course_id, name: r.course_name } : null,
      faculty: toFacultyRef((facultyBySession.get(r.id) || [])[0]),
      faculty_list: toFacultyRefs(facultyBySession.get(r.id)),
      venues: r.venue_id ? { id: r.venue_id, name: r.venue_name, building: r.venue_building } : null,
      session_types: r.session_type_id ? { id: r.session_type_id, name: r.session_type_name } : null,
    }));

    return NextResponse.json({ sessions: formatted });
  } catch (err) {
    console.error('Calendar sessions error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);

