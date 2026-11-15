import { randomUUID } from 'node:crypto';
import { db } from '@/lib/db';
import { notifications, users } from '@/drizzle/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { fetchPreferencesMap, shouldNotifyUser } from '@/lib/should-notify';
import { enqueueTargetedEmails } from '@/lib/notification-stream';

/**
 * Fan a message out to students: in-app notification rows (respecting each student's preferences) and, optionally,
 * emails via the notification_stream outbox. Callers must have already authorised the audience.
 * @returns {Promise<{ inApp: number, emailQueued: number, emailSkipped: string[] }>}
 */
export async function notifyStudents({
  studentIds, type = 'general', title, message, courseId = null, sessionId = null,
  sentBy = null, senderName = '', courseName = '', email = false,
}) {
  const ids = [...new Set((studentIds || []).filter(Boolean))];
  if (!ids.length) return { inApp: 0, emailQueued: 0, emailSkipped: [] };

  const recipients = await db
    .select({ id: users.id, first_name: users.firstName, last_name: users.lastName, email: users.email })
    .from(users)
    .where(and(inArray(users.id, ids), eq(users.isActive, true), eq(users.role, 'student')));
  const prefMap = await fetchPreferencesMap(recipients.map((r) => r.id));
  const eligible = recipients.filter((r) => shouldNotifyUser(prefMap, r.id, type));

  if (eligible.length) {
    await db.insert(notifications).values(eligible.map((r) => ({
      recipientId: r.id, type, title, message, courseId, sessionId, sentBy,
    })));
  }

  let emailQueued = 0;
  let emailSkipped = [];
  if (email && eligible.length) {
    const res = await enqueueTargetedEmails({
      eventType: 'general_notification',
      batchId: randomUUID(),
      items: eligible.map((student) => ({ student, payload: { title, message, senderName, courseName, sessionId } })),
    });
    emailQueued = res.queued;
    emailSkipped = res.skipped || [];
  }
  return { inApp: eligible.length, emailQueued, emailSkipped };
}

/** Student ids enrolled in any of the given courses. */
export async function enrolledStudentIds(courseIds) {
  const { courseEnrollments } = await import('@/drizzle/schema');
  if (!courseIds?.length) return [];
  const rows = await db.select({ id: courseEnrollments.studentId }).from(courseEnrollments)
    .where(inArray(courseEnrollments.courseId, courseIds));
  return [...new Set(rows.map((r) => r.id).filter(Boolean))];
}
