export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { faculty, sessions, courses, venues } from '@/drizzle/schema';
import { eq, desc } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';

const DEFAULT_RATE = 2000;

function sessionDurationHours(startTime, endTime) {
  const start = new Date(`1970-01-01T${startTime}Z`);
  const end = new Date(`1970-01-01T${endTime}Z`);
  return Math.abs((end - start) / (1000 * 60 * 60));
}

async function handler(req) {
  try {
    const facultyId = req.user.id;

    const [facultyProfile, sessionRows] = await Promise.all([
      db
        .select({
          designation: faculty.designation,
          honorarium_rate_per_hour: faculty.honorariumRatePerHour,
          years_experience: faculty.yearsExperience,
          department: faculty.department,
        })
        .from(faculty)
        .where(eq(faculty.id, facultyId))
        .limit(1)
        .then(res => res[0]),
      db
        .select({
          id: sessions.id,
          title: sessions.title,
          session_date: sessions.sessionDate,
          start_time: sessions.startTime,
          end_time: sessions.endTime,
          status: sessions.status,
          course_name: courses.name,
          venue_name: venues.name,
        })
        .from(sessions)
        .leftJoin(courses, eq(sessions.courseId, courses.id))
        .leftJoin(venues, eq(sessions.venueId, venues.id))
        .where(eq(sessions.facultyId, facultyId))
        .orderBy(desc(sessions.sessionDate)),
    ]);

    const rate = Number(facultyProfile?.honorarium_rate_per_hour) || DEFAULT_RATE;
    let totalHours = 0;
    let completedSessions = 0;

    const sessionDetails = (sessionRows || []).map((s) => {
      const durationHrs = sessionDurationHours(s.start_time, s.end_time);
      if (s.status === 'completed') {
        totalHours += durationHrs;
        completedSessions += 1;
      }

      const [y, m, d] = s.session_date.split('-');
      const dObj = new Date(Number(y), Number(m) - 1, Number(d));

      return {
        session_id: s.id,
        title: s.title || 'Untitled Session',
        course: s.course_name || 'Unknown',
        venue: s.venue_name || 'Unknown',
        date: dObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        date_raw: s.session_date,
        duration: `${durationHrs.toFixed(1)}h`,
        status: s.status,
      };
    });

    return NextResponse.json({
      profile: {
        designation: facultyProfile?.designation || '',
        department: facultyProfile?.department || '',
        years_experience: facultyProfile?.years_experience ?? null,
        honorarium_rate_per_hour: rate,
      },
      totalHours: Math.round(totalHours * 10) / 10,
      completedSessions,
      totalSessionCount: (sessionRows || []).length,
      estimatedHonorarium: Math.round(totalHours * rate),
      sessions: sessionDetails,
    });
  } catch (err) {
    console.error('Faculty hours error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(handler, ['faculty']);

