export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { notifications, courses, sessions, users } from '@/drizzle/schema';
import { desc, eq } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';
import { facultyOwnsCourse, getOwnedSession, forbidden } from '@/lib/faculty-access';
import { notifyStudents, enrolledStudentIds } from '@/lib/notification-send';

const MAX_PER_HOUR = 20;
const g = globalThis;
if (!g._facultyNotifySends) g._facultyNotifySends = new Map(); // facultyId -> timestamps (per process)

function rateLimited(facultyId) {
  const now = Date.now();
  const recent = (g._facultyNotifySends.get(facultyId) || []).filter((t) => now - t < 3600_000);
  g._facultyNotifySends.set(facultyId, recent);
  if (recent.length >= MAX_PER_HOUR) return true;
  recent.push(now);
  return false;
}

// Send a message to students. The audience is derived on the server from a module or class the caller teaches;
// recipient ids from the client are never accepted.
async function postHandler(req) {
  try {
    const b = await req.json();
    const title = String(b.title || '').trim();
    const message = String(b.message || '').trim();
    if (!title || title.length > 150) return NextResponse.json({ error: 'Title is required (max 150 characters)' }, { status: 400 });
    if (!message || message.length > 2000) return NextResponse.json({ error: 'Message is required (max 2000 characters)' }, { status: 400 });

    let courseId = null; let sessionId = null;
    if (b.audience === 'session') {
      const s = await getOwnedSession(req.user.id, b.session_id);
      if (!s) return forbidden();
      sessionId = s.id; courseId = s.courseId;
    } else if (b.audience === 'module') {
      if (!(await facultyOwnsCourse(req.user.id, b.course_id))) return forbidden();
      courseId = b.course_id;
    } else {
      return NextResponse.json({ error: 'Choose a module or class to notify' }, { status: 400 });
    }
    if (!courseId) return NextResponse.json({ error: 'This class has no module' }, { status: 400 });

    if (rateLimited(req.user.id)) {
      return NextResponse.json({ error: `You can send at most ${MAX_PER_HOUR} notifications per hour.` }, { status: 429 });
    }

    const studentIds = await enrolledStudentIds([courseId]);
    if (!studentIds.length) return NextResponse.json({ error: 'No students are enrolled in this module' }, { status: 400 });

    const [[course], [me]] = await Promise.all([
      db.select({ name: courses.name }).from(courses).where(eq(courses.id, courseId)).limit(1),
      db.select({ f: users.firstName, l: users.lastName }).from(users).where(eq(users.id, req.user.id)).limit(1),
    ]);
    const result = await notifyStudents({
      studentIds, type: 'faculty_message', title, message, courseId, sessionId,
      sentBy: req.user.id, senderName: `${me?.f || ''} ${me?.l || ''}`.trim(), courseName: course?.name || '', email: b.email === true,
    });
    return NextResponse.json({ success: true, audience: studentIds.length, ...result });
  } catch (err) {
    console.error('Faculty notify error:', err);
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}

// History of what this faculty member sent (one row per message, with its recipient count).
async function getHandler(req) {
  try {
    const rows = await db
      .select({ id: notifications.id, type: notifications.type, title: notifications.title, message: notifications.message, course_id: notifications.courseId, created_at: notifications.createdAt, course_name: courses.name, session_title: sessions.title })
      .from(notifications)
      .leftJoin(courses, eq(notifications.courseId, courses.id))
      .leftJoin(sessions, eq(notifications.sessionId, sessions.id))
      .where(eq(notifications.sentBy, req.user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(2000);

    const groups = new Map();
    for (const r of rows) {
      const key = `${r.title}|${r.message}|${r.course_id}|${String(r.created_at).slice(0, 19)}`;
      const gr = groups.get(key);
      if (gr) gr.recipients += 1;
      else groups.set(key, { type: r.type, title: r.title, message: r.message, course_name: r.course_name, session_title: r.session_title, created_at: r.created_at, recipients: 1 });
    }
    return NextResponse.json({ sent: [...groups.values()].slice(0, 100) });
  } catch (err) {
    console.error('Faculty notify history error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withRole(postHandler, ['faculty']);
export const GET = withRole(getHandler, ['faculty']);
