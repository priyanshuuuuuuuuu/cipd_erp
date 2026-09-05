import { supabaseAdmin } from '@/lib/supabase';
import { getFeedbackDeadline } from '@/lib/feedback-deadline';
import { fetchPreferencesMap, shouldNotifyUser } from '@/lib/should-notify';
import {
  enqueueFeedbackMessages,
  isNotificationSandboxEnabled,
} from '@/lib/notification-stream';

/**
 * Creates in-app feedback notifications and durable email jobs for a completed
 * session. It is safe to call repeatedly: the in-app notification and every
 * email job have stable deduplication keys.
 *
 * In sandbox mode, no real student receives email. The configured sandbox
 * recipients receive the feedback template even when a test session has no
 * attendance records.
 */
export async function rolloutFeedbackForSession(sessionId, onlyStudentIds = null) {
  const result = {
    notified: 0,
    queued: 0,
    alreadyQueued: 0,
    skipped: 0,
    sandbox: isNotificationSandboxEnabled(),
    recipients: [],
    errors: [],
  };

  try {
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('sessions')
      .select('id, title, session_date, start_time, end_time, feedback_deadline, course_id, courses ( id, name ), faculty ( id, users ( first_name, last_name ) )')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      result.errors.push('Session not found: ' + (sessionError?.message || 'unknown error'));
      return result;
    }

    const deadline = getFeedbackDeadline(session);

    // Sandbox mail is intentionally isolated from production students.
    if (result.sandbox) {
      const queued = await enqueueFeedbackMessages(session, deadline.toISOString(), []);
      result.queued = queued.queued;
      result.alreadyQueued = queued.alreadyQueued;
      result.recipients = queued.recipients;
      return result;
    }

    let presentStudentIds = onlyStudentIds;
    if (!presentStudentIds) {
      const { data: attended, error: attendanceError } = await supabaseAdmin
        .from('attendance_records')
        .select('student_id')
        .eq('session_id', sessionId)
        .in('status', ['present', 'partial']);

      if (attendanceError) {
        result.errors.push('Attendance lookup failed: ' + attendanceError.message);
        return result;
      }
      presentStudentIds = (attended || []).map((row) => row.student_id);
    }

    if (!presentStudentIds?.length) return result;

    const { data: existingNotifications, error: existingError } = await supabaseAdmin
      .from('notifications')
      .select('recipient_id')
      .eq('session_id', sessionId)
      .eq('type', 'feedback_available');

    if (existingError) {
      result.errors.push('Notification lookup failed: ' + existingError.message);
      return result;
    }

    const alreadyNotified = new Set((existingNotifications || []).map((row) => row.recipient_id));
    const pendingIds = presentStudentIds.filter((id) => !alreadyNotified.has(id));
    result.skipped = presentStudentIds.length - pendingIds.length;

    const { data: students, error: studentsError } = await supabaseAdmin
      .from('users')
      .select('id, first_name, last_name, email')
      .in('id', presentStudentIds)
      .eq('is_active', true);

    if (studentsError) {
      result.errors.push('Student lookup failed: ' + studentsError.message);
      return result;
    }

    const allStudents = students || [];
    const preferences = await fetchPreferencesMap(supabaseAdmin, allStudents.map((student) => student.id));
    const emailStudents = allStudents.filter((student) =>
      shouldNotifyUser(preferences, student.id, 'feedback_available')
    );

    const inAppStudents = allStudents.filter((student) =>
      pendingIds.includes(student.id) && shouldNotifyUser(preferences, student.id, 'feedback_available')
    );

    if (inAppStudents.length) {
      const notifications = inAppStudents.map((student) => ({
        recipient_id: student.id,
        type: 'feedback_available',
        title: '📝 Feedback: ' + (session.courses?.name || session.title),
        message: 'Your feedback form for "' + session.title + '" is ready. Deadline: '
          + deadline.toLocaleString('en-IN') + '. Submit now!',
        course_id: session.course_id,
        session_id: session.id,
        is_read: false,
      }));

      const { error: notificationError } = await supabaseAdmin
        .from('notifications')
        .insert(notifications);

      if (notificationError) {
        result.errors.push('Notification insert failed: ' + notificationError.message);
        return result;
      }
    }

    const queued = await enqueueFeedbackMessages(session, deadline.toISOString(), emailStudents);
    result.queued = queued.queued;
    result.alreadyQueued = queued.alreadyQueued;
    result.notified = inAppStudents.length;
    result.recipients = queued.recipients;
  } catch (error) {
    result.errors.push(error.message);
    console.error('rolloutFeedbackForSession error:', error.message);
  }

  return result;
}
