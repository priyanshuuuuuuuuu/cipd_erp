export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessions, courses, venues, courseEnrollments, students, users, coursePosts, sessionChangeRequests, sessionMaterials } from '@/drizzle/schema';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';
import { getOwnedSession, forbidden } from '@/lib/faculty-access';
import { getISTDateString, getISTTimeString } from '@/lib/ist-date';
import { resolveFileUrl } from '@/lib/storage';

// Detail of one of the caller's own classes: roster, materials tagged to it, change-request history.
async function getHandler(req, { params }) {
  try {
    const owned = await getOwnedSession(req.user.id, params.id);
    if (!owned) return forbidden();

    const [row] = await db
      .select({
        id: sessions.id, title: sessions.title, date: sessions.sessionDate, start: sessions.startTime, end: sessions.endTime,
        status: sessions.status, course_id: sessions.courseId, course_name: courses.name, venue: venues.name, building: venues.building,
      })
      .from(sessions)
      .leftJoin(courses, eq(sessions.courseId, courses.id))
      .leftJoin(venues, eq(sessions.venueId, venues.id))
      .where(eq(sessions.id, owned.id)).limit(1);

    const enrolled = row.course_id
      ? await db.select({ id: courseEnrollments.studentId }).from(courseEnrollments).where(eq(courseEnrollments.courseId, row.course_id))
      : [];
    const ids = [...new Set(enrolled.map((e) => e.id).filter(Boolean))];
    const roster = ids.length
      ? await db.select({ id: students.id, enrollment_no: students.enrollmentNo, first_name: users.firstName, last_name: users.lastName })
          .from(students).innerJoin(users, eq(students.id, users.id)).where(inArray(students.id, ids))
      : [];

    const [posts, legacy, requests] = await Promise.all([
      db.select({ id: coursePosts.id, type: coursePosts.type, title: coursePosts.title, file_url: coursePosts.fileUrl, file_bucket: coursePosts.fileBucket, link_url: coursePosts.linkUrl, created_at: coursePosts.createdAt })
        .from(coursePosts).where(eq(coursePosts.sessionId, owned.id)).orderBy(desc(coursePosts.createdAt)),
      db.select({ id: sessionMaterials.id, title: sessionMaterials.title, file_url: sessionMaterials.fileUrl, created_at: sessionMaterials.createdAt })
        .from(sessionMaterials).where(eq(sessionMaterials.sessionId, owned.id)),
      db.select().from(sessionChangeRequests).where(eq(sessionChangeRequests.sessionId, owned.id)).orderBy(desc(sessionChangeRequests.createdAt)),
    ]);
    const materials = await Promise.all([
      ...posts.map(async (p) => ({ id: p.id, type: p.type, title: p.title, link_url: p.link_url, created_at: p.created_at, file_url: p.file_url ? await resolveFileUrl(p.file_bucket || 'course-posts', p.file_url) : null })),
      ...legacy.filter((m) => !posts.some((p) => p.title === m.title)).map(async (m) => ({ id: `legacy-${m.id}`, type: 'material', title: m.title, link_url: null, created_at: m.created_at, file_url: m.file_url ? await resolveFileUrl('session-materials', m.file_url) : null })),
    ]);

    return NextResponse.json({
      session: row,
      roster: roster.map((s) => ({ id: s.id, enrollment_no: s.enrollment_no || '', name: `${s.first_name || ''} ${s.last_name || ''}`.trim() })).sort((a, b) => a.name.localeCompare(b.name)),
      materials,
      change_requests: requests.map((c) => ({
        id: c.id, kind: c.kind, reason: c.reason, status: c.status, admin_notes: c.adminNotes, created_at: c.createdAt,
        proposed_date: c.proposedDate, proposed_start: c.proposedStart, proposed_end: c.proposedEnd,
      })),
    });
  } catch (err) {
    console.error('Faculty session detail error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH { action: 'complete' }: mark one of your own classes completed once it has started.
async function patchHandler(req, { params }) {
  try {
    const owned = await getOwnedSession(req.user.id, params.id);
    if (!owned) return forbidden();
    const { action } = await req.json();
    if (action !== 'complete') return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    if (owned.status !== 'scheduled') return NextResponse.json({ error: `Class is already ${owned.status}` }, { status: 409 });

    const today = getISTDateString();
    const now = getISTTimeString();
    const started = owned.sessionDate < today || (owned.sessionDate === today && owned.startTime <= now);
    if (!started) return NextResponse.json({ error: 'You can mark a class completed only once it has started.' }, { status: 400 });

    await db.update(sessions).set({ status: 'completed' }).where(and(eq(sessions.id, owned.id), eq(sessions.facultyId, req.user.id)));
    return NextResponse.json({ success: true, status: 'completed' });
  } catch (err) {
    console.error('Faculty session update error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(getHandler, ['faculty']);
export const PATCH = withRole(patchHandler, ['faculty']);
