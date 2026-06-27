export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendDayBeforeReminderEmail } from '@/lib/emailer';
import { fetchPreferencesMap, shouldNotifyUser } from '@/lib/should-notify';

/**
 * GET /api/cron/reminder
 * Called once daily (e.g. 8 AM) — finds all sessions tomorrow, emails enrolled students.
 * Must pass header:  x-cron-secret: <CRON_SECRET from .env.local>
 */
export async function GET(req) {
  // Security: verify cron secret
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Build tomorrow's date in UTC (server-side cron runs in UTC)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD

    // Fetch all sessions scheduled for tomorrow
    const { data: sessions, error } = await supabaseAdmin
      .from('sessions')
      .select(`
        id, title, session_date, start_time, end_time, course_id,
        courses ( id, name ),
        faculty ( id, users ( first_name, last_name ) ),
        venues ( id, name, building )
      `)
      .eq('session_date', tomorrowStr)
      .neq('status', 'cancelled');

    if (error) throw error;
    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ message: 'No sessions tomorrow', sent: 0 });
    }

    let totalSent = 0;
    const errors = [];

    for (const session of sessions) {
      // Get all students enrolled in this course
      const { data: enrollments } = await supabaseAdmin
        .from('course_enrollments')
        .select('student_id')
        .eq('course_id', session.course_id);

      if (!enrollments || enrollments.length === 0) continue;

      const studentIds = enrollments.map(e => e.student_id);

      // Fetch student emails from users table
      const { data: students } = await supabaseAdmin
        .from('users')
        .select('id, first_name, last_name, email')
        .in('id', studentIds)
        .eq('is_active', true);

      const prefMap = await fetchPreferencesMap(
        supabaseAdmin,
        (students || []).map((s) => s.id)
      );

      for (const student of (students || [])) {
        if (!shouldNotifyUser(prefMap, student.id, 'class_reminder')) continue;

        try {
          const name = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';
          await sendDayBeforeReminderEmail(student.email, name, session);
          totalSent++;

          // Also log into notifications table
          await supabaseAdmin.from('notifications').insert({
            recipient_id: student.id,
            type: 'class_reminder',
            title: `Class Tomorrow: ${session.title}`,
            message: `Reminder: ${session.title} is on ${session.session_date} at ${session.start_time?.slice(0, 5)} in ${session.venues?.name || 'TBA'}.`,
            course_id: session.course_id,
            session_id: session.id,
            is_read: false,
          });
        } catch (emailErr) {
          console.error(`Reminder email failed for ${student.email}:`, emailErr.message);
          errors.push({ student: student.email, error: emailErr.message });
        }
      }
    }

    return NextResponse.json({
      message: 'Daily reminders processed',
      date: tomorrowStr,
      sessions: sessions.length,
      emailsSent: totalSent,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error('Cron reminder error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
