// A class can have several faculty (table session_faculty). sessions.faculty_id is legacy: it is still written
// (= first faculty, for rollback) but must NOT be read for access, hours, notifications or display.
import { db } from '@/lib/db';
import { sessions, sessionFaculty, faculty, users } from '@/drizzle/schema';
import { sql, inArray, asc } from 'drizzle-orm';
import { enqueueTargetedEmails } from '@/lib/notification-stream';
import { randomUUID } from 'node:crypto';

/** SQL condition for a query on `sessions`: this faculty member is assigned to the session. */
export function sessionHasFaculty(facultyId) {
  return sql`EXISTS (SELECT 1 FROM ${sessionFaculty} WHERE ${sessionFaculty.sessionId} = ${sessions.id} AND ${sessionFaculty.facultyId} = ${facultyId})`;
}

/** Accepts { faculty_ids: [] } or legacy { faculty_id }. Returns a de-duplicated array of ids, or undefined when neither key was sent. */
export function parseFacultyIds(body) {
  if (!body) return undefined;
  let raw;
  if (Array.isArray(body.faculty_ids)) raw = body.faculty_ids;
  else if (body.faculty_ids === null) raw = [];
  else if (body.faculty_id !== undefined) raw = body.faculty_id ? [body.faculty_id] : [];
  else return undefined;
  return [...new Set(raw.filter((x) => typeof x === 'string' && x))];
}

/** Map sessionId -> [{ id, first_name, last_name, email }] ordered by assignment position. */
export async function loadSessionFaculty(sessionIds, client = db) {
  const map = new Map();
  const ids = [...new Set((sessionIds || []).filter(Boolean))];
  if (!ids.length) return map;
  const rows = await client
    .select({
      session_id: sessionFaculty.sessionId,
      id: faculty.id,
      first_name: users.firstName,
      last_name: users.lastName,
      email: users.email,
    })
    .from(sessionFaculty)
    .innerJoin(faculty, sql`${sessionFaculty.facultyId} = ${faculty.id}`)
    .leftJoin(users, sql`${faculty.id} = ${users.id}`)
    .where(inArray(sessionFaculty.sessionId, ids))
    .orderBy(asc(sessionFaculty.position), asc(sessionFaculty.assignedAt));
  for (const r of rows) {
    if (!map.has(r.session_id)) map.set(r.session_id, []);
    map.get(r.session_id).push({ id: r.id, first_name: r.first_name, last_name: r.last_name, email: r.email });
  }
  return map;
}

export const facultyFullName = (f) => `${f?.first_name || ''} ${f?.last_name || ''}`.trim();
export const facultyNamesJoined = (list) => (list || []).map(facultyFullName).filter(Boolean).join(', ');

/**
 * Replace the faculty of a session. Pass a transaction (or db). Unknown ids are rejected by the FK.
 * Keeps the legacy sessions.faculty_id column in step (first faculty, or null).
 */
export async function replaceSessionFaculty(client, sessionId, facultyIds) {
  const ids = [...new Set(facultyIds || [])];
  await client.execute(sql`DELETE FROM ${sessionFaculty} WHERE ${sessionFaculty.sessionId} = ${sessionId}`);
  if (ids.length) {
    await client.insert(sessionFaculty).values(ids.map((facultyId, i) => ({ sessionId, facultyId, position: i })));
  }
  await client.update(sessions).set({ facultyId: ids[0] || null }).where(sql`${sessions.id} = ${sessionId}`);
}

/**
 * Email every given faculty member that a class was assigned to them.
 * Returns { queued, sandbox, error? } and never throws (scheduling must not fail because email failed).
 */
export async function notifyFacultyAssigned(facultyIds, { title, session_date, start_time, end_time }, { updated = false } = {}) {
  const ids = [...new Set(facultyIds || [])];
  if (!ids.length) return null;
  try {
    const recipients = await db
      .select({ id: users.id, email: users.email, first_name: users.firstName, last_name: users.lastName })
      .from(users)
      .where(inArray(users.id, ids));
    const withEmail = recipients.filter((r) => r.email);
    if (!withEmail.length) return { queued: 0, error: 'Faculty email address not found.' };
    const result = await enqueueTargetedEmails({
      eventType: 'general_notification',
      batchId: randomUUID(),
      items: withEmail.map((recipient) => ({
        student: recipient,
        payload: {
          type: 'class_reminder',
          title: `${updated ? 'You were added to a class' : 'New class scheduled'}: ${title}`,
          message: `A class has been assigned to you: ${title} on ${session_date}, ${start_time}–${end_time} (India time). Please check your schedule for details.`,
        },
      })),
    });
    return { queued: result.queued, sandbox: result.sandbox, ...(withEmail.length < ids.length ? { error: 'Some faculty have no email address.' } : {}) };
  } catch (error) {
    console.error('Faculty class notification queue error:', error);
    return { queued: 0, error: 'Could not queue faculty email.' };
  }
}

/** { id, users: { first_name, last_name } } — the shape older API consumers expect for `faculty`. */
export const toFacultyRef = (f) => (f ? { id: f.id, users: { first_name: f.first_name, last_name: f.last_name } } : null);
export const toFacultyRefs = (list) => (list || []).map(toFacultyRef);
