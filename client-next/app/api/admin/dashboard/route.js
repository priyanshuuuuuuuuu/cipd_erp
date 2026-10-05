export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { students, faculty, sessions } from '@/drizzle/schema';
import { eq, and, ne, desc, sql } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';
import { getISTDateString } from '@/lib/ist-date';

async function handler(req) {
  try {
    // Counts come straight from the current cohort's tables (the public view isn't cohort-aware)
    const [[studentsRes], [facultyRes], [sessionsRes]] = await Promise.all([
      db.select({ count: sql`count(*)` }).from(students),
      db.select({ count: sql`count(*)` }).from(faculty),
      db.select({ count: sql`count(*)` }).from(sessions),
    ]);

    const summary = {
      total_students: Number(studentsRes?.count || 0),
      total_faculty: Number(facultyRes?.count || 0),
      total_sessions: Number(sessionsRes?.count || 0),
    };

    // Get today's session count (IST date)
    const today = getISTDateString();
    
    const [todaySessionsRes] = await db.select({ count: sql`count(*)` })
      .from(sessions)
      .where(and(
        eq(sessions.sessionDate, today),
        ne(sessions.status, 'cancelled')
      ));
      
    const todaySessions = Number(todaySessionsRes?.count || 0);

    // Get recent activity - ordered by creation time so latest actions appear first
    const recentSessionsData = await db.query.sessions.findMany({
      with: { course: { columns: { name: true } } },
      orderBy: [desc(sessions.createdAt)],
      limit: 10
    });
    
    const formattedRecent = recentSessionsData.map(s => ({
      id: s.id,
      title: s.title,
      session_date: s.sessionDate,
      start_time: s.startTime,
      end_time: s.endTime,
      status: s.status,
      created_at: s.createdAt,
      courses: { name: s.course?.name }
    }));

    return NextResponse.json({
      summary: summary || { total_students: 0, total_faculty: 0, total_sessions: 0 },
      today_sessions: todaySessions || 0,
      recent_sessions: formattedRecent || [],
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(handler, ['admin']);
