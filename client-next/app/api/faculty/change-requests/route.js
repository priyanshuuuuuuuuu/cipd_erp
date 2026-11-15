export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessionChangeRequests, sessions, courses } from '@/drizzle/schema';
import { and, desc, eq } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';
import { getOwnedSession, forbidden } from '@/lib/faculty-access';
import { getISTDateString } from '@/lib/ist-date';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

async function getHandler(req) {
  try {
    const rows = await db
      .select({
        id: sessionChangeRequests.id, session_id: sessionChangeRequests.sessionId, kind: sessionChangeRequests.kind,
        proposed_date: sessionChangeRequests.proposedDate, proposed_start: sessionChangeRequests.proposedStart,
        proposed_end: sessionChangeRequests.proposedEnd, reason: sessionChangeRequests.reason, status: sessionChangeRequests.status,
        admin_notes: sessionChangeRequests.adminNotes, created_at: sessionChangeRequests.createdAt,
        session_title: sessions.title, session_date: sessions.sessionDate, start_time: sessions.startTime, course_name: courses.name,
      })
      .from(sessionChangeRequests)
      .innerJoin(sessions, eq(sessionChangeRequests.sessionId, sessions.id))
      .leftJoin(courses, eq(sessions.courseId, courses.id))
      .where(eq(sessionChangeRequests.facultyId, req.user.id))
      .orderBy(desc(sessionChangeRequests.createdAt));
    return NextResponse.json({ requests: rows });
  } catch (err) {
    console.error('Faculty change requests list error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function postHandler(req) {
  try {
    const b = await req.json();
    const kind = b.kind;
    const reason = String(b.reason || '').trim();
    if (!['cancel', 'reschedule'].includes(kind)) return NextResponse.json({ error: 'Invalid request type' }, { status: 400 });
    if (!reason || reason.length > 1000) return NextResponse.json({ error: 'A reason is required (max 1000 characters)' }, { status: 400 });

    const session = await getOwnedSession(req.user.id, b.session_id);
    if (!session) return forbidden();
    if (session.status !== 'scheduled') return NextResponse.json({ error: `This class is ${session.status}` }, { status: 409 });
    if (session.sessionDate < getISTDateString()) return NextResponse.json({ error: 'This class is in the past' }, { status: 400 });

    const [pending] = await db.select({ id: sessionChangeRequests.id }).from(sessionChangeRequests)
      .where(and(eq(sessionChangeRequests.sessionId, session.id), eq(sessionChangeRequests.status, 'pending'))).limit(1);
    if (pending) return NextResponse.json({ error: 'There is already a pending request for this class' }, { status: 409 });

    let proposed = {};
    if (kind === 'reschedule') {
      const { proposed_date: d, proposed_start: s, proposed_end: e } = b;
      if (!DATE_RE.test(d || '') || !TIME_RE.test(s || '') || !TIME_RE.test(e || '')) {
        return NextResponse.json({ error: 'New date, start and end time are required' }, { status: 400 });
      }
      if (e <= s) return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 });
      if (d < getISTDateString()) return NextResponse.json({ error: 'New date cannot be in the past' }, { status: 400 });
      proposed = { proposedDate: d, proposedStart: s, proposedEnd: e };
    }

    const [created] = await db.insert(sessionChangeRequests)
      .values({ sessionId: session.id, facultyId: req.user.id, kind, reason, ...proposed }).returning();
    return NextResponse.json({ request: created }, { status: 201 });
  } catch (err) {
    console.error('Faculty change request error:', err);
    return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 });
  }
}

export const GET = withRole(getHandler, ['faculty']);
export const POST = withRole(postHandler, ['faculty']);
