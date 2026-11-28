export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessions, courses, venues, courseEnrollments, sessionSkills } from '@/drizzle/schema';
import { eq, ne, and, inArray, asc, count } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';
import { getISTDateString } from '@/lib/ist-date';
import { loadSessionFaculty, parseFacultyIds, replaceSessionFaculty, notifyFacultyAssigned } from '@/lib/session-faculty';

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
        venue_id: venues.id,
        venue_name: venues.name,
        venue_building: venues.building,
      })
      .from(sessions)
      .leftJoin(courses, eq(sessions.courseId, courses.id))
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

    const facultyBySession = await loadSessionFaculty((sessionRows || []).map(s => s.id));

    const sessionsWithCounts = (sessionRows || []).map(s => ({
      id: s.id,
      title: s.title,
      session_date: s.session_date,
      start_time: s.start_time,
      end_time: s.end_time,
      status: s.status,
      created_at: s.created_at,
      courses: s.course_id ? { id: s.course_id, name: s.course_name } : null,
      faculty: (facultyBySession.get(s.id) || [])[0]
        ? { id: facultyBySession.get(s.id)[0].id, users: { first_name: facultyBySession.get(s.id)[0].first_name, last_name: facultyBySession.get(s.id)[0].last_name } }
        : null,
      faculty_list: (facultyBySession.get(s.id) || []).map(f => ({ id: f.id, users: { first_name: f.first_name, last_name: f.last_name } })),
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
    const body = await req.json();
    const { course_id, title, venue_id, session_date, start_time, end_time, session_type_id, skill_ids } = body;
    const facultyIds = parseFacultyIds(body) || [];

    if (!title || !session_date || !start_time || !end_time) {
      return NextResponse.json({ error: 'title, session_date, start_time, and end_time are required' }, { status: 400 });
    }

    let inserted = null;
    try {
      inserted = await db.transaction(async (tx) => {
        const [newSession] = await tx
          .insert(sessions)
          .values({
            courseId: course_id || null,
            facultyId: facultyIds[0] || null, // legacy column = first faculty; session_faculty is the source of truth
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
        await replaceSessionFaculty(tx, newSession.id, facultyIds);
        return newSession;
      });
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

    const facultyEmail = inserted ? await notifyFacultyAssigned(facultyIds, { title, session_date, start_time, end_time }) : null;
    return NextResponse.json({ session: inserted, facultyEmail }, { status: 201 });
  } catch (err) {
    console.error('Create session error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(getHandler, ['admin']);
export const POST = withRole(postHandler, ['admin']);
