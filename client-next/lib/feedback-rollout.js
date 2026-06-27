import { supabaseAdmin } from '@/lib/supabase';
import { sendFeedbackAvailableEmail } from '@/lib/emailer';
import { getFeedbackDeadline } from '@/lib/feedback-deadline';
import { fetchPreferencesMap, shouldNotifyUser } from '@/lib/should-notify';

/**
 * Rolls out feedback notifications + emails to all students who attended a session.
 * Safe to call multiple times — skips students who already have a notification for this session.
 *
 * @param {string} sessionId  - UUID of the completed session
 * @param {string[]} [onlyStudentIds] - optional allowlist (e.g. from live attendance records);
 *                                       if omitted, queries attendance_records from DB
 * @returns {{ notified: number, skipped: number, errors: string[] }}
 */
export async function rolloutFeedbackForSession(sessionId, onlyStudentIds = null) {
  const result = { notified: 0, skipped: 0, errors: [] };

  try {
    // 1. Get session details
    const { data: session, error: sessErr } = await supabaseAdmin
      .from('sessions')
      .select(`
        id, title, session_date, start_time, end_time, feedback_deadline, course_id,
        courses ( id, name ),
        faculty ( id, users ( first_name, last_name ) )
      `)
      .eq('id', sessionId)
      .single();

    if (sessErr || !session) {
      result.errors.push(`Session not found: ${sessErr?.message}`);
      return result;
    }

    // 2. Determine which students attended
    let presentStudentIds = onlyStudentIds;
    if (!presentStudentIds) {
      const { data: attended } = await supabaseAdmin
        .from('attendance_records')
        .select('student_id')
        .eq('session_id', sessionId)
        .in('status', ['present', 'partial']);
      presentStudentIds = (attended || []).map((r) => r.student_id);
    }

    if (presentStudentIds.length === 0) {
      return result; // no one to notify
    }

    // 3. Filter out students who already have a feedback_available notification for this session
    const { data: existingNotifs } = await supabaseAdmin
      .from('notifications')
      .select('recipient_id')
      .eq('session_id', sessionId)
      .eq('type', 'feedback_available');

    const alreadyNotifiedIds = new Set((existingNotifs || []).map((n) => n.recipient_id));
    const pendingIds = presentStudentIds.filter((id) => !alreadyNotifiedIds.has(id));

    result.skipped = presentStudentIds.length - pendingIds.length;

    if (pendingIds.length === 0) return result;

    // 4. Compute deadline (admin override or default 24h after session end IST)
    const deadline = getFeedbackDeadline(session);

    // 5. Get student details
    const { data: students } = await supabaseAdmin
      .from('users')
      .select('id, first_name, last_name, email')
      .in('id', pendingIds)
      .eq('is_active', true);

    if (!students || students.length === 0) return result;

    const prefMap = await fetchPreferencesMap(
      supabaseAdmin,
      students.map((s) => s.id)
    );
    const eligibleStudents = students.filter((s) =>
      shouldNotifyUser(prefMap, s.id, 'feedback_available')
    );

    if (eligibleStudents.length === 0) return result;

    // 6. Insert notifications
    const notifications = eligibleStudents.map((s) => ({
      recipient_id: s.id,
      type: 'feedback_available',
      title: `📝 Feedback: ${session.courses?.name || session.title}`,
      message: `Your feedback form for "${session.title}" is ready. Deadline: ${deadline.toLocaleString('en-IN')}. Submit now!`,
      course_id: session.course_id,
      session_id: session.id,
      is_read: false,
    }));

    const { error: notifErr } = await supabaseAdmin.from('notifications').insert(notifications);
    if (notifErr) {
      result.errors.push(`Notification insert failed: ${notifErr.message}`);
      return result;
    }

    // 7. Send emails (fire-and-forget, non-blocking)
    Promise.allSettled(
      eligibleStudents.map(async (student) => {
        try {
          const name = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';
          await sendFeedbackAvailableEmail(student.email, name, session, deadline.toISOString());
          console.log(`✉ Feedback email sent to ${student.email}`);
        } catch (emailErr) {
          console.error(`Feedback email failed for ${student.email}:`, emailErr.message);
        }
      })
    );

    result.notified = eligibleStudents.length;
    console.log(
      `Feedback rollout for "${session.title}" — ${result.notified} notified, ${result.skipped} already had notification`
    );
  } catch (err) {
    result.errors.push(err.message);
    console.error('rolloutFeedbackForSession error:', err.message);
  }

  return result;
}
