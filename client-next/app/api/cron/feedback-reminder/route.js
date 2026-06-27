export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendFeedbackReminderEmail } from '@/lib/emailer';
import { getFeedbackDeadline } from '@/lib/feedback-deadline';
import { fetchPreferencesMap, shouldNotifyUser } from '@/lib/should-notify';
/**
 * GET /api/cron/feedback-reminder
 * Runs periodically — finds feedback forms where deadline is ~4 hours away,
 * sends reminder emails + notifications to students who haven't submitted yet.
 * Secured by CRON_SECRET header.
 */
export async function GET(req) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();

    // Get all completed sessions
    const { data: sessions } = await supabaseAdmin
      .from('sessions')
      .select(`
        id, title, session_date, start_time, end_time, feedback_deadline, course_id,
        courses ( id, name ),
        faculty ( id, users ( first_name, last_name ) )
      `)
      .eq('status', 'completed');

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ message: 'No completed sessions', sent: 0 });
    }

    let totalSent = 0;
    const errors = [];

    for (const session of sessions) {
      const deadline = getFeedbackDeadline(session);

      // Check if deadline is 3-5 hours away (4-hour reminder window)
      const hoursLeft = (deadline - now) / 3600000;
      if (hoursLeft < 3 || hoursLeft > 5) continue;

      // Get students who attended but haven't submitted
      const { data: attended } = await supabaseAdmin
        .from('attendance_records')
        .select('student_id')
        .eq('session_id', session.id)
        .in('status', ['present', 'partial']);

      if (!attended || attended.length === 0) continue;

      const attendedIds = attended.map(a => a.student_id);

      const { data: submitted } = await supabaseAdmin
        .from('feedback_responses')
        .select('student_id')
        .eq('session_id', session.id);

      const submittedIds = new Set((submitted || []).map(s => s.student_id));
      const pendingIds = attendedIds.filter(id => !submittedIds.has(id));

      if (pendingIds.length === 0) continue;

      // Check if we already sent a reminder for this session (avoid duplicates)
      const { count: existingReminders } = await supabaseAdmin
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', session.id)
        .eq('type', 'feedback_deadline_reminder');

      if (existingReminders > 0) continue;

      // Get student details
      const { data: students } = await supabaseAdmin
        .from('users')
        .select('id, first_name, last_name, email')
        .in('id', pendingIds)
        .eq('is_active', true);

      const prefMap = await fetchPreferencesMap(
        supabaseAdmin,
        (students || []).map((s) => s.id)
      );

      for (const student of (students || [])) {
        if (!shouldNotifyUser(prefMap, student.id, 'feedback_deadline_reminder')) continue;

        try {
          const name = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';

          // Insert notification
          await supabaseAdmin.from('notifications').insert({
            recipient_id: student.id,
            type: 'feedback_deadline_reminder',
            title: `⏰ Feedback due soon: ${session.courses?.name || session.title}`,
            message: `Your feedback for "${session.title}" is due in ~${Math.round(hoursLeft)} hours. Submit now!`,
            course_id: session.course_id,
            session_id: session.id,
            is_read: false,
          });

          // Send email (fire-and-forget)
          sendFeedbackReminderEmail(student.email, name, session, hoursLeft).catch(err => {
            console.error(`Feedback reminder email failed for ${student.email}:`, err.message);
          });

          totalSent++;
        } catch (emailErr) {
          errors.push({ student: student.email, error: emailErr.message });
        }
      }
    }

    return NextResponse.json({
      message: 'Feedback reminders processed',
      remindersSent: totalSent,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error('Feedback reminder cron error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
