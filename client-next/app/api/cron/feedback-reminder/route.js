export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db, runWithSchema, getActiveSchema } from '@/lib/db';
import {
  sessions,
  courses,
  faculty,
  users,
  attendanceRecords,
  feedbackResponses,
  notifications,
} from '@/drizzle/schema';
import { eq, and, inArray, count } from 'drizzle-orm';
import { sendFeedbackReminderEmail } from '@/lib/emailer';
import { getFeedbackDeadline } from '@/lib/feedback-deadline';
import { fetchPreferencesMap, shouldNotifyUser } from '@/lib/should-notify';

/**
 * GET /api/cron/feedback-reminder
 * Runs periodically — finds feedback forms where deadline is ~4 hours away,
 * sends reminder emails + notifications to students who haven't submitted yet.
 * Secured by CRON_SECRET header.
 */
async function cronHandler(req) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();

    // Get all completed sessions
    const sessionRows = await db
      .select({
        id: sessions.id,
        title: sessions.title,
        session_date: sessions.sessionDate,
        start_time: sessions.startTime,
        end_time: sessions.endTime,
        feedback_deadline: sessions.feedbackDeadline,
        course_id: sessions.courseId,
        course_name: courses.name,
        faculty_id: faculty.id,
        faculty_first_name: users.firstName,
        faculty_last_name: users.lastName,
      })
      .from(sessions)
      .leftJoin(courses, eq(sessions.courseId, courses.id))
      .leftJoin(faculty, eq(sessions.facultyId, faculty.id))
      .leftJoin(users, eq(faculty.id, users.id))
      .where(eq(sessions.status, 'completed'));

    if (!sessionRows || sessionRows.length === 0) {
      return NextResponse.json({ message: 'No completed sessions', sent: 0 });
    }

    let totalSent = 0;
    const errors = [];

    for (const session of sessionRows) {
      const deadline = getFeedbackDeadline(session);

      // Check if deadline is 3-5 hours away (4-hour reminder window)
      const hoursLeft = (deadline - now) / 3600000;
      if (hoursLeft < 3 || hoursLeft > 5) continue;

      // Get students who attended but haven't submitted
      const attended = await db
        .select({ student_id: attendanceRecords.studentId })
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.sessionId, session.id),
            inArray(attendanceRecords.status, ['present', 'partial'])
          )
        );

      if (!attended || attended.length === 0) continue;

      const attendedIds = attended.map(a => a.student_id).filter(Boolean);
      if (attendedIds.length === 0) continue;

      const submitted = await db
        .select({ student_id: feedbackResponses.studentId })
        .from(feedbackResponses)
        .where(eq(feedbackResponses.sessionId, session.id));

      const submittedIds = new Set(submitted.map(s => s.student_id).filter(Boolean));
      const pendingIds = attendedIds.filter(id => !submittedIds.has(id));

      if (pendingIds.length === 0) continue;

      // Check if we already sent a reminder for this session (avoid duplicates)
      const [remCount] = await db
        .select({ count: count() })
        .from(notifications)
        .where(
          and(
            eq(notifications.sessionId, session.id),
            eq(notifications.type, 'feedback_deadline_reminder')
          )
        );

      if (Number(remCount?.count || 0) > 0) continue;

      // Get student details
      const studentList = await db
        .select({
          id: users.id,
          first_name: users.firstName,
          last_name: users.lastName,
          email: users.email,
        })
        .from(users)
        .where(
          and(
            inArray(users.id, pendingIds),
            eq(users.isActive, true)
          )
        );

      const prefMap = await fetchPreferencesMap(
        db,
        studentList.map((s) => s.id)
      );

      for (const student of studentList) {
        if (!shouldNotifyUser(prefMap, student.id, 'feedback_deadline_reminder')) continue;

        try {
          const name = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';

          // Insert notification
          await db.insert(notifications).values({
            recipientId: student.id,
            type: 'feedback_deadline_reminder',
            title: `⏰ Feedback due soon: ${session.course_name || session.title}`,
            message: `Your feedback for "${session.title}" is due in ~${Math.round(hoursLeft)} hours. Submit now!`,
            courseId: session.course_id,
            sessionId: session.id,
            isRead: false,
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


// Cron jobs operate on the currently active cohort.
export async function GET(req) {
  return runWithSchema(await getActiveSchema(), () => cronHandler(req));
}
