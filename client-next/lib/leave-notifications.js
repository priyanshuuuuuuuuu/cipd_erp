import { supabaseAdmin } from '@/lib/supabase';

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
  const { data: admins } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('role', 'admin')
    .eq('is_active', true);

  if (!admins?.length) return;

  const scope = sessionTitle
    ? `session "${sessionTitle}" on ${leaveDate}`
    : `all sessions on ${leaveDate}`;

  const notifications = admins.map((admin) => ({
    recipient_id: admin.id,
    type: 'leave_request',
    title: `Leave request: ${studentName}`,
    message: `${studentName} requested leave for ${scope}. Reason: ${reason.slice(0, 200)}`,
    sent_by: studentId,
  }));

  const { error } = await supabaseAdmin.from('notifications').insert(notifications);
  if (error) {
    console.error('notifyAdminsOfLeaveRequest error:', error.message);
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
  const { error } = await supabaseAdmin.from('notifications').insert({
    recipient_id: studentId,
    type: approved ? 'leave_approved' : 'leave_rejected',
    title: approved ? 'Leave approved' : 'Leave rejected',
    message: approved
      ? `Your leave request for ${leaveDate} has been approved.${adminNotes ? ` Note: ${adminNotes}` : ''}`
      : `Your leave request for ${leaveDate} was rejected.${adminNotes ? ` Reason: ${adminNotes}` : ''}`,
    sent_by: reviewerId,
  });

  if (error) {
    console.error('notifyStudentLeaveDecision error:', error.message);
  }
}
