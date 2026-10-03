export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessions, courses, faculty, users, feedbackResponses } from '@/drizzle/schema';
import { eq, gte, isNotNull, desc, and, count } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';
import { getISTMonthStart } from '@/lib/ist-date';

async function handler(request) {
  try {
    const startOfMonth = getISTMonthStart();

    const [recentSessions, [{ value: totalCompleted }], [{ value: thisMonth }], ratingsData] = await Promise.all([
      db
        .select({
          id: sessions.id,
          session_date: sessions.sessionDate,
          status: sessions.status,
          course_id: sessions.courseId,
          course_name: courses.name,
          first_name: users.firstName,
          last_name: users.lastName,
        })
        .from(sessions)
        .leftJoin(courses, eq(sessions.courseId, courses.id))
        .leftJoin(faculty, eq(sessions.facultyId, faculty.id))
        .leftJoin(users, eq(faculty.id, users.id))
        .where(eq(sessions.status, 'completed'))
        .orderBy(desc(sessions.sessionDate))
        .limit(10),

      db
        .select({ value: count() })
        .from(sessions)
        .where(eq(sessions.status, 'completed')),

      db
        .select({ value: count() })
        .from(sessions)
        .where(and(eq(sessions.status, 'completed'), gte(sessions.sessionDate, startOfMonth))),

      db
        .select({ rating: feedbackResponses.rating })
        .from(feedbackResponses)
        .where(isNotNull(feedbackResponses.rating)),
    ]);

    const allRatings = (ratingsData || []).map(r => r.rating).filter(r => r != null);
    const avgRating = allRatings.length > 0
      ? (allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(1)
      : '—';

    const recentReports = (recentSessions || []).map((s, i) => {
      const facultyName = s.first_name || s.last_name
        ? `Prof. ${s.first_name || ''} ${s.last_name || ''}`.trim()
        : 'Unknown';
      const courseName = s.course_name || 'Unknown Course';
      const dateStr = s.session_date
        ? new Date(s.session_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : '';
      const typeOptions = ['Attendance Summary', 'Course Feedback', 'Faculty Evaluation'];
      return {
        id: s.id,
        name: `${facultyName} — ${courseName}`,
        type: typeOptions[i % typeOptions.length],
        date: dateStr,
        status: 'Available',
      };
    });

    const metrics = {
      totalReports: Number(totalCompleted || 0),
      generatedThisMonth: Number(thisMonth || 0),
      avgRating: avgRating !== '—' ? `${avgRating}/5` : '—',
    };

    return NextResponse.json({ recentReports, metrics });

  } catch (error) {
    console.error('Reports API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const GET = withRole(handler, ['admin']);
