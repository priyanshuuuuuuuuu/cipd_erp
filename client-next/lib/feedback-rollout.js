import { db } from '@/lib/db';
import { sessions, courses, faculty, users, attendanceRecords, notifications } from '@/drizzle/schema';
import { eq, and, inArray } from 'drizzle-orm';
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
    const [session] = await db
      .select({
        id: sessions.id,
        title: sessions.title,
        session_date: sessions.sessionDate,
        start_time: sessions.startTime,
        end_time: sessions.endTime,
        feedback_deadline: sessions.feedbackDeadline,
        course_id: sessions.courseId,
        course_name: courses.name,
        faculty_first_name: users.firstName,
        faculty_last_name: users.lastName,
      })
      .from(sessions)
      .leftJoin(courses, eq(sessions.courseId, courses.id))
      .leftJoin(faculty, eq(sessions.facultyId, faculty.id))
      .leftJoin(users, eq(faculty.id, users.id))
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (!session) {
      result.errors.push('Session not found: unknown error');
      return result;
    }

    const formattedSession = {
      ...session,
      courses: { id: session.course_id, name: session.course_name },
      faculty: { users: { first_name: session.faculty_first_name, last_name: session.faculty_last_name } },
    };

    const deadline = getFeedbackDeadline(formattedSession);

    // Sandbox mail is intentionally isolated from production students.
    if (result.sandbox) {
      const queued = await enqueueFeedbackMessages(formattedSession, deadline.toISOString(), []);
      result.queued = queued.queued;
      result.alreadyQueued = queued.alreadyQueued;
      result.recipients = queued.recipients;
      return result;
    }

    let presentStudentIds = onlyStudentIds;
    if (!presentStudentIds) {
      const attended = await db
        .select({ student_id: attendanceRecords.studentId })
        .from(attendanceRecords)
        .where(and(
          eq(attendanceRecords.sessionId, sessionId),
          inArray(attendanceRecords.status, ['present', 'partial'])
        ));

      presentStudentIds = (attended || []).map((row) => row.student_id);
    }

    if (!presentStudentIds?.length) return result;

    const existingNotifications = await db
      .select({ recipient_id: notifications.recipientId })
      .from(notifications)
      .where(and(
        eq(notifications.sessionId, sessionId),
        eq(notifications.type, 'feedback_available')
      ));

    const alreadyNotified = new Set((existingNotifications || []).map((row) => row.recipient_id));
    const pendingIds = presentStudentIds.filter((id) => !alreadyNotified.has(id));
    result.skipped = presentStudentIds.length - pendingIds.length;

    const allStudents = await db
      .select({
        id: users.id,
        first_name: users.firstName,
        last_name: users.lastName,
        email: users.email,
      })
      .from(users)
      .where(and(
        inArray(users.id, presentStudentIds),
        eq(users.isActive, true)
      ));

    const preferences = await fetchPreferencesMap(allStudents.map((student) => student.id));
    const emailStudents = allStudents.filter((student) =>
      shouldNotifyUser(preferences, student.id, 'feedback_available')
    );

    const inAppStudents = allStudents.filter((student) =>
      pendingIds.includes(student.id) && shouldNotifyUser(preferences, student.id, 'feedback_available')
    );

    if (inAppStudents.length) {
      const notifRows = inAppStudents.map((student) => ({
        recipientId: student.id,
        type: 'feedback_available',
        title: '📝 Feedback: ' + (formattedSession.courses?.name || formattedSession.title),
        message: 'Your feedback form for "' + formattedSession.title + '" is ready. Deadline: '
          + deadline.toLocaleString('en-IN') + '. Submit now!',
        courseId: formattedSession.course_id,
        sessionId: formattedSession.id,
        isRead: false,
      }));

      try {
        await db.insert(notifications).values(notifRows);
      } catch (notificationError) {
        result.errors.push('Notification insert failed: ' + notificationError.message);
        return result;
      }
    }

    const queued = await enqueueFeedbackMessages(formattedSession, deadline.toISOString(), emailStudents);
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
