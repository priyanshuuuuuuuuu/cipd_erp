import { db } from '@/lib/db';
import { attendanceRecords } from '@/drizzle/schema';
import { eq, inArray, and } from 'drizzle-orm';

/** Attendance statuses that qualify a student for session feedback. */
export const ATTENDED_STATUSES = ['present', 'partial'];

/**
 * Returns true if the student was marked present or partial for the session.
 */
export async function isStudentEligibleForSessionFeedback(client, studentId, sessionId) {
  const record = await db.query.attendanceRecords.findFirst({
    columns: { status: true },
    where: and(
        eq(attendanceRecords.sessionId, sessionId),
        eq(attendanceRecords.studentId, studentId)
    )
  });

  return !!record && ATTENDED_STATUSES.includes(record.status);
}

/**
 * Session IDs where the student has present/partial attendance.
 */
export async function getEligibleSessionIdsForStudent(client, studentId) {
  const rows = await db.query.attendanceRecords.findMany({
    columns: { sessionId: true },
    where: and(
        eq(attendanceRecords.studentId, studentId),
        inArray(attendanceRecords.status, ATTENDED_STATUSES)
    )
  });

  return [...new Set((rows || []).map((r) => r.sessionId))];
}

/**
 * Returns a map of session_id → count of students with present/partial attendance.
 */
export async function getAttendedCountBySession(client, sessionIds = null) {
  const rows = await db.query.attendanceRecords.findMany({
    columns: { sessionId: true },
    where: sessionIds && sessionIds.length > 0
        ? and(
            inArray(attendanceRecords.sessionId, sessionIds),
            inArray(attendanceRecords.status, ATTENDED_STATUSES)
          )
        : inArray(attendanceRecords.status, ATTENDED_STATUSES)
  });

  const counts = {};
  (rows || []).forEach((r) => {
    counts[r.sessionId] = (counts[r.sessionId] || 0) + 1;
  });
  return counts;
}
