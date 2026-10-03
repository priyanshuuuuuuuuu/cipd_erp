export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessions, courses, faculty, users, venues, courseEnrollments, sessionSkills } from '@/drizzle/schema';
import { eq, ne, and, inArray, asc, count } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';
import { getISTDateString } from '@/lib/ist-date';

async function getHandler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const todayFlag = searchParams.get('today') === 'true';

    const conditions = [];
    if (status) conditions.push(eq(sessions.status, status));
    if (todayFlag) {
      const todayDate = getISTDateString();
      conditions.push(eq(sessions.sessionDate, todayDate));
      conditions.push(ne(sessions.status, 'cancelled'));
    }

    const sessionRows = await db
      .select({
        id: sessions.id,
        title: sessions.title,
        session_date: sessions.sessionDate,
        start_time: sessions.startTime,
        end_time: sessions.endTime,
        status: sessions.status,
        created_at: sessions.createdAt,
        course_id: courses.id,
        course_name: courses.name,
        faculty_id: faculty.id,
        first_name: users.firstName,
        last_name: users.lastName,
        venue_id: venues.id,
        venue_name: venues.name,
        venue_building: venues.building,
      })
      .from(sessions)
      .leftJoin(courses, eq(sessions.courseId, courses.id))
      .leftJoin(faculty, eq(sessions.facultyId, faculty.id))
      .leftJoin(users, eq(faculty.id, users.id))
      .leftJoin(venues, eq(sessions.venueId, venues.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(sessions.sessionDate), asc(sessions.startTime))
      .limit(50);

    const courseIds = [...new Set((sessionRows || []).map(s => s.course_id).filter(Boolean))];
    const enrollmentCounts = {};
    if (courseIds.length > 0) {
      const countsData = await db
        .select({
          course_id: courseEnrollments.courseId,
          total: count(),
        })
        .from(courseEnrollments)
        .where(inArray(courseEnrollments.courseId, courseIds))
        .groupBy(courseEnrollments.courseId);

      countsData.forEach(c => {
        if (c.course_id) enrollmentCounts[c.course_id] = Number(c.total || 0);
      });
    }

    const sessionsWithCounts = (sessionRows || []).map(s => ({
      id: s.id,
      title: s.title,
      session_date: s.session_date,
      start_time: s.start_time,
      end_time: s.end_time,
      status: s.status,
      created_at: s.created_at,
      courses: s.course_id ? { id: s.course_id, name: s.course_name } : null,
      faculty: s.faculty_id ? { id: s.faculty_id, users: { first_name: s.first_name, last_name: s.last_name } } : null,
      venues: s.venue_id ? { id: s.venue_id, name: s.venue_name, building: s.venue_building } : null,
      enrolled_students: enrollmentCounts[s.course_id] || 0,
    }));

    return NextResponse.json({ sessions: sessionsWithCounts });
  } catch (err) {
    console.error('Admin sessions error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function postHandler(req) {
  try {
    const { course_id, faculty_id, title, venue_id, session_date, start_time, end_time, session_type_id, skill_ids } = await req.json();

    if (!title || !session_date || !start_time || !end_time) {
      return NextResponse.json({ error: 'title, session_date, start_time, and end_time are required' }, { status: 400 });
    }

    let inserted = null;
    try {
      const [newSession] = await db
        .insert(sessions)
        .values({
          courseId: course_id || null,
          facultyId: faculty_id || null,
          title,
          venueId: venue_id || null,
          sessionTypeId: session_type_id || null,
          sessionDate: session_date,
          startTime: start_time,
          endTime: end_time,
          status: 'scheduled',
          createdBy: req.user.id,
        })
        .returning();
      inserted = newSession;
    } catch (dbErr) {
      if (dbErr.code === '23505' || dbErr.message?.includes('unique constraint')) {
        return NextResponse.json({ error: 'Venue conflict: another session is already scheduled at this venue and time' }, { status: 409 });
      }
      console.error('Create session error:', dbErr);
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }

    if (skill_ids && skill_ids.length > 0 && inserted) {
      try {
        const skillsToInsert = skill_ids.map(skill_id => ({
          sessionId: inserted.id,
          skillId: skill_id,
        }));
        await db.insert(sessionSkills).values(skillsToInsert);
      } catch (skillErr) {
        console.error('Failed to insert session skills:', skillErr);
      }
    }

    return NextResponse.json({ session: inserted }, { status: 201 });
  } catch (err) {
    console.error('Create session error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(getHandler, ['admin']);
export const POST = withRole(postHandler, ['admin']);
