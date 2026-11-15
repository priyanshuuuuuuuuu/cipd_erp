export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessionChangeRequests, sessions, courses } from '@/drizzle/schema';
import { and, eq, gt, lt, ne, or } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';
import { notifyStudents, enrolledStudentIds } from '@/lib/notification-send';

// Approve / reject a faculty cancel or reschedule request. Approval applies it to the session and tells enrolled students.
async function handler(req, { params }) {
  try {
    const { status, admin_notes } = await req.json();
    if (!['approved', 'rejected'].includes(status)) return NextResponse.json({ error: 'status must be approved or rejected' }, { status: 400 });

    const [r] = await db.select().from(sessionChangeRequests).where(eq(sessionChangeRequests.id, params.id)).limit(1);
    if (!r) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    if (r.status !== 'pending') return NextResponse.json({ error: `Request already ${r.status}` }, { status: 409 });

    const [s] = await db.select().from(sessions).where(eq(sessions.id, r.sessionId)).limit(1);
    if (!s) return NextResponse.json({ error: 'Session no longer exists' }, { status: 404 });

    if (status === 'approved') {
      if (s.status !== 'scheduled') return NextResponse.json({ error: `The class is already ${s.status}` }, { status: 409 });
      if (r.kind === 'reschedule') {
        // No double-booking of the faculty member or the venue at the new time.
        const clashWho = [eq(sessions.facultyId, s.facultyId)];
        if (s.venueId) clashWho.push(eq(sessions.venueId, s.venueId));
        const [clash] = await db.select({ id: sessions.id, title: sessions.title }).from(sessions)
          .where(and(
            eq(sessions.sessionDate, r.proposedDate), ne(sessions.id, s.id), ne(sessions.status, 'cancelled'),
            lt(sessions.startTime, r.proposedEnd), gt(sessions.endTime, r.proposedStart),
            or(...clashWho),
          )).limit(1);
        if (clash) return NextResponse.json({ error: `The new time clashes with "${clash.title}" (same faculty or venue).` }, { status: 409 });
      }
    }

    await db.transaction(async (tx) => {
      await tx.update(sessionChangeRequests).set({
        status, adminNotes: String(admin_notes || '').trim() || null, decidedBy: req.user.id, decidedAt: new Date().toISOString(),
      }).where(eq(sessionChangeRequests.id, r.id));
      if (status === 'approved') {
        if (r.kind === 'cancel') await tx.update(sessions).set({ status: 'cancelled' }).where(eq(sessions.id, s.id));
        else await tx.update(sessions).set({ sessionDate: r.proposedDate, startTime: r.proposedStart, endTime: r.proposedEnd }).where(eq(sessions.id, s.id));
      }
    });

    if (status === 'approved' && s.courseId) {
      try {
        const [c] = await db.select({ name: courses.name }).from(courses).where(eq(courses.id, s.courseId)).limit(1);
        const msg = r.kind === 'cancel'
          ? `${s.title} on ${s.sessionDate} has been cancelled.`
          : `${s.title} has moved from ${s.sessionDate} ${String(s.startTime).slice(0, 5)} to ${r.proposedDate} ${String(r.proposedStart).slice(0, 5)}–${String(r.proposedEnd).slice(0, 5)}.`;
        await notifyStudents({
          studentIds: await enrolledStudentIds([s.courseId]), type: 'schedule_change',
          title: `Schedule change: ${c?.name || s.title}`, message: msg, courseId: s.courseId, sessionId: s.id,
          sentBy: req.user.id, courseName: c?.name || '', email: false,
        });
      } catch (e) { console.error('Schedule-change notification failed:', e); }
    }

    return NextResponse.json({ success: true, status });
  } catch (err) {
    console.error('Admin change decision error:', err);
    return NextResponse.json({ error: 'Failed to update request' }, { status: 500 });
  }
}

export const PATCH = withRole(handler, ['admin']);
