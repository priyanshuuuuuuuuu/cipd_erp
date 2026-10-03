export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessions, courses, venues } from '@/drizzle/schema';
import { eq, and, ne, gte, asc } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';
import { getISTDateString } from '@/lib/ist-date';

async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const upcoming = searchParams.get('upcoming') === 'true';

    const conditions = [eq(sessions.facultyId, req.user.id)];
    if (upcoming) {
      const today = getISTDateString(); // IST date
      conditions.push(gte(sessions.sessionDate, today));
      conditions.push(ne(sessions.status, 'cancelled'));
    }

    const rows = await db
      .select({
        id: sessions.id,
        title: sessions.title,
        session_date: sessions.sessionDate,
        start_time: sessions.startTime,
        end_time: sessions.endTime,
        status: sessions.status,
        course_id: sessions.courseId,
        course_name: courses.name,
        venue_name: venues.name,
      })
      .from(sessions)
      .leftJoin(courses, eq(sessions.courseId, courses.id))
      .leftJoin(venues, eq(sessions.venueId, venues.id))
      .where(and(...conditions))
      .orderBy(asc(sessions.sessionDate), asc(sessions.startTime));

    const mapped = (rows || []).map((s) => ({
      id: s.id,
      title: s.title || 'Untitled',
      course: s.course_name || 'Unknown',
      course_id: s.course_id,
      venue: s.venue_name || 'TBA',
      date: s.session_date,
      time: s.start_time?.slice(0, 5),
      endTime: s.end_time?.slice(0, 5),
      status: s.status === 'scheduled' ? 'Scheduled' : s.status.charAt(0).toUpperCase() + s.status.slice(1),
    }));

    return NextResponse.json({ sessions: mapped });
  } catch (err) {
    console.error('Faculty schedule error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(handler, ['faculty']);

