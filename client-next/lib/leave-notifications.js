import { db } from '@/lib/db';
import { users, notifications } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Notify all active admins about a new leave request.
 * @param {object} params
 * @param {string} params.leaveRequestId
 * @param {string} params.studentId
 * @param {string} params.studentName
 * @param {string} params.leaveDate
 * @param {string} [params.sessionTitle]
 * @param {string} params.reason
 */
export async function notifyAdminsOfLeaveRequest({
  leaveRequestId,
  studentId,
  studentName,
  leaveDate,
  sessionTitle,
  reason,
}) {
  const admins = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, 'admin'), eq(users.isActive, true)));

  if (!admins?.length) return;

  const scope = sessionTitle
    ? `session "${sessionTitle}" on ${leaveDate}`
    : `all sessions on ${leaveDate}`;

  const notificationRows = admins.map((admin) => ({
    recipientId: admin.id,
    type: 'leave_request',
    title: `Leave request: ${studentName}`,
    message: `${studentName} requested leave for ${scope}. Reason: ${reason.slice(0, 200)}`,
    sentBy: studentId,
  }));

  try {
    await db.insert(notifications).values(notificationRows);
  } catch (error) {
    console.error('notifyAdminsOfLeaveRequest error:', error?.message || error);
  }

  return { notified: admins.length, leaveRequestId };
}

/**
 * Notify student when leave is approved/rejected.
 */
export async function notifyStudentLeaveDecision({
  studentId,
  leaveDate,
  status,
  adminNotes,
  reviewerId,
}) {
  const approved = status === 'approved';
  try {
    await db.insert(notifications).values({
      recipientId: studentId,
      type: approved ? 'leave_approved' : 'leave_rejected',
      title: approved ? 'Leave approved' : 'Leave rejected',
      message: approved
        ? `Your leave request for ${leaveDate} has been approved.${adminNotes ? ` Note: ${adminNotes}` : ''}`
        : `Your leave request for ${leaveDate} was rejected.${adminNotes ? ` Reason: ${adminNotes}` : ''}`,
      sentBy: reviewerId,
    });
  } catch (error) {
    console.error('notifyStudentLeaveDecision error:', error?.message || error);
  }
}
