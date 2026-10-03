export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db as defaultDb, getSchemaDb, getCohortConfig } from '@/lib/db';
import { attendanceRecords, sessions as sessionsTable, courses } from '@/drizzle/schema';
import { eq, and, desc, count } from 'drizzle-orm';
import { withAuth } from '@/lib/middleware';

async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const courseFilter = searchParams.get('course');
    const dateFilter = searchParams.get('date');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;

    const conditions = [
      eq(attendanceRecords.studentId, req.user.id),
      eq(sessionsTable.status, 'completed'),
    ];
    if (dateFilter) {
      conditions.push(eq(sessionsTable.sessionDate, dateFilter));
    }

    let db = defaultDb;
    if (req.user?.schema) {
      db = getSchemaDb(req.user.schema);
    } else {
      const { schemas } = getCohortConfig();
      // Fast fallback to find the student's schema if missing in JWT
      for (const s of (schemas && schemas.length ? schemas : ['july'])) {
        const schemaDb = getSchemaDb(s);
        const [{ value }] = await schemaDb.select({ value: count() }).from(attendanceRecords).where(eq(attendanceRecords.studentId, req.user.id));
        if (value > 0) {
          db = schemaDb;
          break;
        }
      }
    }

    const [{ value: totalCount }] = await db
      .select({ value: count() })
      .from(attendanceRecords)
      .innerJoin(sessionsTable, eq(attendanceRecords.sessionId, sessionsTable.id))
      .where(and(...conditions));

    const total = Number(totalCount || 0);

    const records = await db
      .select({
        id: attendanceRecords.id,
        status: attendanceRecords.status,
        points: attendanceRecords.points,
        ping_count: attendanceRecords.pingCount,
        calculated_at: attendanceRecords.calculatedAt,
        first_seen_at: attendanceRecords.firstSeenAt,
        last_seen_at: attendanceRecords.lastSeenAt,
        duration_minutes: attendanceRecords.durationMinutes,
        sessions: {
          id: sessionsTable.id,
          title: sessionsTable.title,
          session_date: sessionsTable.sessionDate,
          start_time: sessionsTable.startTime,
          end_time: sessionsTable.endTime,
          status: sessionsTable.status,
          courses: {
            id: courses.id,
            name: courses.name,
          },
        },
      })
      .from(attendanceRecords)
      .innerJoin(sessionsTable, eq(attendanceRecords.sessionId, sessionsTable.id))
      .leftJoin(courses, eq(sessionsTable.courseId, courses.id))
      .where(and(...conditions))
      .orderBy(desc(attendanceRecords.calculatedAt))
      .limit(limit)
      .offset(offset);

    let filtered = records || [];

    if (courseFilter && courseFilter !== 'all') {
      filtered = filtered.filter(
        (r) =>
          r.sessions?.courses?.id === courseFilter ||
          r.sessions?.courses?.name === courseFilter
      );
    }

    filtered.sort((a, b) => {
      const da = a.sessions?.session_date || '';
      const dbDate = b.sessions?.session_date || '';
      if (da !== dbDate) return dbDate.localeCompare(da);
      return (a.sessions?.start_time || '').localeCompare(
        b.sessions?.start_time || ''
      );
    });

    const sessionsList = filtered.map((r) => ({
      id: r.id,
      status: r.status,
      points: r.points,
      ping_count: r.ping_count,
      first_seen_at: r.first_seen_at,
      last_seen_at: r.last_seen_at,
      duration_minutes: r.duration_minutes,
      calculated_at: r.calculated_at,
      sessions: r.sessions
        ? {
            id: r.sessions.id,
            title: r.sessions.title,
            session_date: r.sessions.session_date,
            start_time: r.sessions.start_time,
            end_time: r.sessions.end_time,
            courses: r.sessions.courses,
          }
        : null,
    }));

    return NextResponse.json({
      sessions: sessionsList,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      source: 'attendance_records',
    });
  } catch (err) {
    console.error('Attendance sessions error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
