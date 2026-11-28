export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessionChangeRequests, facultyLeave, sessions, courses, users } from '@/drizzle/schema';
import { and, desc, eq, gte, lte, ne } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';
import { sessionHasFaculty } from '@/lib/session-faculty';

// Faculty-originated requests for the admin: session cancel/reschedule requests and faculty leave.
async function handler(req) {
  try {
    const status = new URL(req.url).searchParams.get('status');
    const filterStatus = ['pending', 'approved', 'rejected'].includes(status) ? status : null;

    const changeRows = await db
      .select({
        id: sessionChangeRequests.id, kind: sessionChangeRequests.kind, reason: sessionChangeRequests.reason,
        status: sessionChangeRequests.status, admin_notes: sessionChangeRequests.adminNotes, created_at: sessionChangeRequests.createdAt,
        proposed_date: sessionChangeRequests.proposedDate, proposed_start: sessionChangeRequests.proposedStart, proposed_end: sessionChangeRequests.proposedEnd,
        session_id: sessions.id, session_title: sessions.title, session_date: sessions.sessionDate, start_time: sessions.startTime, end_time: sessions.endTime,
        course_name: courses.name, first_name: users.firstName, last_name: users.lastName,
      })
      .from(sessionChangeRequests)
      .innerJoin(sessions, eq(sessionChangeRequests.sessionId, sessions.id))
      .leftJoin(courses, eq(sessions.courseId, courses.id))
      .leftJoin(users, eq(sessionChangeRequests.facultyId, users.id))
      .where(filterStatus ? eq(sessionChangeRequests.status, filterStatus) : undefined)
      .orderBy(desc(sessionChangeRequests.createdAt));

    const leaveRows = await db
      .select({
        id: facultyLeave.id, faculty_id: facultyLeave.facultyId, from_date: facultyLeave.fromDate, to_date: facultyLeave.toDate,
        reason: facultyLeave.reason, status: facultyLeave.status, admin_notes: facultyLeave.adminNotes, created_at: facultyLeave.createdAt,
        first_name: users.firstName, last_name: users.lastName,
      })
      .from(facultyLeave)
      .leftJoin(users, eq(facultyLeave.facultyId, users.id))
      .where(filterStatus ? eq(facultyLeave.status, filterStatus) : undefined)
      .orderBy(desc(facultyLeave.createdAt));

    // Sessions of that faculty inside the leave window that still need cover (admin decides; nothing is auto-cancelled).
    const leave = await Promise.all(leaveRows.map(async (l) => {
      const affected = await db
        .select({ id: sessions.id, title: sessions.title, date: sessions.sessionDate, start: sessions.startTime })
        .from(sessions)
        .where(and(sessionHasFaculty(l.faculty_id), gte(sessions.sessionDate, l.from_date), lte(sessions.sessionDate, l.to_date), ne(sessions.status, 'cancelled')));
      return { ...l, name: `${l.first_name || ''} ${l.last_name || ''}`.trim(), affected_sessions: affected };
    }));

    return NextResponse.json({
      changes: changeRows.map((c) => ({ ...c, faculty_name: `${c.first_name || ''} ${c.last_name || ''}`.trim() })),
      leave,
    });
  } catch (err) {
    console.error('Admin faculty requests error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(handler, ['admin']);
