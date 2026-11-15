import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { courseFaculty, sessions, courseEnrollments } from '@/drizzle/schema';
import { and, eq, isNotNull } from 'drizzle-orm';

/** Modules a faculty member teaches: explicit admin assignment ∪ any module they have a session in. */
export async function getFacultyCourseIds(facultyId) {
  const [assigned, taught] = await Promise.all([
    db.select({ id: courseFaculty.courseId }).from(courseFaculty).where(eq(courseFaculty.facultyId, facultyId)),
    db.selectDistinct({ id: sessions.courseId }).from(sessions)
      .where(and(eq(sessions.facultyId, facultyId), isNotNull(sessions.courseId))),
  ]);
  return [...new Set([...assigned, ...taught].map((r) => r.id).filter(Boolean))];
}

export async function facultyOwnsCourse(facultyId, courseId) {
  if (!courseId) return false;
  return (await getFacultyCourseIds(facultyId)).includes(courseId);
}

/** Returns the session row if it belongs to this faculty, else null. */
export async function getOwnedSession(facultyId, sessionId) {
  if (!sessionId) return null;
  const [row] = await db.select().from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.facultyId, facultyId))).limit(1);
  return row || null;
}

export async function isStudentEnrolled(studentId, courseId) {
  if (!courseId) return false;
  const [row] = await db.select({ id: courseEnrollments.id }).from(courseEnrollments)
    .where(and(eq(courseEnrollments.courseId, courseId), eq(courseEnrollments.studentId, studentId))).limit(1);
  return !!row;
}

export const forbidden = (msg = 'Forbidden') => NextResponse.json({ error: msg }, { status: 403 });

/** Student passes if enrolled; admins and faculty-who-teach pass too (read-only views). */
export async function canViewCourse(user, courseId) {
  if (user.role === 'admin') return true;
  if (user.role === 'faculty') return facultyOwnsCourse(user.id, courseId);
  return isStudentEnrolled(user.id, courseId);
}

const URL_RE = /^https?:\/\//i;
/** http(s) only: blocks javascript:, data:, file: etc. Returns normalised URL or null. */
export function safeHttpUrl(value) {
  const v = String(value || '').trim();
  if (!URL_RE.test(v)) return null;
  try { return new URL(v).toString(); } catch { return null; }
}
