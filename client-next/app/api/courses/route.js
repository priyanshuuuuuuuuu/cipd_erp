export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  courses,
  courseEnrollments,
  assignments,
  sessions,
  sessionMaterials,
  faculty,
  users,
  venues,
} from '@/drizzle/schema';
import { eq, count } from 'drizzle-orm';
import { withAuth } from '@/lib/middleware';

async function handler(req) {
  try {
    if (req.user.role === 'admin') {
      // Admin sees all courses
      const coursesData = await db
        .select({
          id: courses.id,
          name: courses.name,
          description: courses.description,
          created_at: courses.createdAt,
          code: courses.code,
        })
        .from(courses)
        .orderBy(courses.name);

      return NextResponse.json({ courses: coursesData || [] });
    }

    // Student sees enrolled courses
    const enrollments = await db
      .select({
        id: courses.id,
        name: courses.name,
        description: courses.description,
        created_at: courses.createdAt,
        code: courses.code,
      })
      .from(courseEnrollments)
      .leftJoin(courses, eq(courseEnrollments.courseId, courses.id))
      .where(eq(courseEnrollments.studentId, req.user.id));

    const baseCourses = enrollments.map(e => ({
      id: e.id,
      name: e.name,
      description: e.description,
      created_at: e.created_at,
      code: e.code,
    }));

    // Fetch related data for each course to build the rich UI
    const coursesResult = await Promise.all(
      baseCourses.map(async (course) => {
        // 1. Get assignments count
        const [asnRes] = await db
          .select({ count: count() })
          .from(assignments)
          .where(eq(assignments.courseId, course.id));
        const asnCount = Number(asnRes?.count || 0);

        // 2. Get sessions for faculty, venue, schedule, and count
        const sessionList = await db
          .select({
            id: sessions.id,
            start_time: sessions.startTime,
            end_time: sessions.endTime,
            session_date: sessions.sessionDate,
            venue_name: venues.name,
            faculty_first_name: users.firstName,
            faculty_last_name: users.lastName,
          })
          .from(sessions)
          .leftJoin(venues, eq(sessions.venueId, venues.id))
          .leftJoin(faculty, eq(sessions.facultyId, faculty.id))
          .leftJoin(users, eq(faculty.id, users.id))
          .where(eq(sessions.courseId, course.id));

        const sessionsCount = sessionList.length;

        // 3. Calculate materials count
        const [matRes] = await db
          .select({ count: count() })
          .from(sessionMaterials)
          .where(eq(sessionMaterials.courseId, course.id));
        const materialsCount = Number(matRes?.count || 0);

        // Extract primary faculty & venue (just pick the first session's details)
        let facultyName = null;
        let venueName = null;
        let schedule = null;
        
        // Use real course code from DB; fall back to initials only if still null (pre-migration)
        const mockCode = course.code || (course.name ? course.name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 5) + '101' : 'COURSE101');

        if (sessionList.length > 0) {
          const first = sessionList[0];
          if (first.faculty_first_name || first.faculty_last_name) {
             facultyName = `Prof. ${first.faculty_first_name || ''} ${first.faculty_last_name || ''}`.trim();
          }
          if (first.venue_name) {
             venueName = first.venue_name;
          }
          
          // Build a mock schedule string based on start_time
          const st = first.start_time ? first.start_time.substring(0, 5) : '09:00';
          schedule = `Mon, Wed · ${st} AM`; 
        }

        return {
          ...course,
          code: mockCode,
          faculty_name: facultyName || 'Unknown Faculty',
          venue: venueName || 'TBA',
          schedule: schedule || 'TBA',
          sessions_count: sessionsCount,
          materials_count: materialsCount,
          assignments_count: asnCount,
        };
      })
    );

    return NextResponse.json({ courses: coursesResult });
  } catch (err) {
    console.error('Courses error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);

