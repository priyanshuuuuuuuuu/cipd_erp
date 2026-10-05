export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db, runWithSchema, getActiveSchema } from '@/lib/db';
import {
  sessions,
  courses,
  faculty,
  users,
  venues,
  courseEnrollments,
  notifications,
} from '@/drizzle/schema';
import { eq, ne, and, inArray } from 'drizzle-orm';
import { sendDayBeforeReminderEmail } from '@/lib/emailer';
import { fetchPreferencesMap, shouldNotifyUser } from '@/lib/should-notify';
import { getISTNow } from '@/lib/ist-date';

/**
 * GET /api/cron/reminder
 * Called once daily (e.g. 8 AM) — finds all sessions tomorrow, emails enrolled students.
 * Must pass header:  x-cron-secret: <CRON_SECRET from .env.local>
 */
async function cronHandler(req) {
  // Security: verify cron secret
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Build tomorrow's date in IST (cron server may run in UTC)
    const tomorrow = getISTNow();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD (IST)

    // Fetch all sessions scheduled for tomorrow
    const sessionRows = await db
      .select({
        id: sessions.id,
        title: sessions.title,
        session_date: sessions.sessionDate,
        start_time: sessions.startTime,
        end_time: sessions.endTime,
        course_id: sessions.courseId,
        course_name: courses.name,
        faculty_id: faculty.id,
        faculty_first_name: users.firstName,
        faculty_last_name: users.lastName,
        venue_id: venues.id,
        venue_name: venues.name,
        venue_building: venues.building,
      })
      .from(sessions)
      .leftJoin(courses, eq(sessions.courseId, courses.id))
      .leftJoin(faculty, eq(sessions.facultyId, faculty.id))
      .leftJoin(users, eq(faculty.id, users.id))
      .leftJoin(venues, eq(sessions.venueId, venues.id))
      .where(
        and(
          eq(sessions.sessionDate, tomorrowStr),
          ne(sessions.status, 'cancelled')
        )
      );

    if (!sessionRows || sessionRows.length === 0) {
      return NextResponse.json({ message: 'No sessions tomorrow', sent: 0 });
    }

    let totalSent = 0;
    const errors = [];

    for (const session of sessionRows) {
      // Get all students enrolled in this course
      const enrollments = await db
        .select({ student_id: courseEnrollments.studentId })
        .from(courseEnrollments)
        .where(eq(courseEnrollments.courseId, session.course_id));

      if (!enrollments || enrollments.length === 0) continue;

      const studentIds = enrollments.map(e => e.student_id).filter(Boolean);
      if (studentIds.length === 0) continue;

      // Fetch student emails from users table
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
            inArray(users.id, studentIds),
            eq(users.isActive, true)
          )
        );

      const prefMap = await fetchPreferencesMap(
        db,
        studentList.map((s) => s.id)
      );

      for (const student of studentList) {
        if (!shouldNotifyUser(prefMap, student.id, 'class_reminder')) continue;

        try {
          const name = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';
          const sessionPayload = {
            ...session,
            courses: { name: session.course_name },
            venues: { name: session.venue_name, building: session.venue_building },
            faculty: { users: { first_name: session.faculty_first_name, last_name: session.faculty_last_name } },
          };
          await sendDayBeforeReminderEmail(student.email, name, sessionPayload);
          totalSent++;

          // Also log into notifications table
          await db.insert(notifications).values({
            recipientId: student.id,
            type: 'class_reminder',
            title: `Class Tomorrow: ${session.title}`,
            message: `Reminder: ${session.title} is on ${session.session_date} at ${session.start_time?.slice(0, 5)} in ${session.venue_name || 'TBA'}.`,
            courseId: session.course_id,
            sessionId: session.id,
            isRead: false,
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
      sessions: sessionRows.length,
      emailsSent: totalSent,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error('Cron reminder error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


// Cron jobs operate on the currently active cohort.
export async function GET(req) {
  return runWithSchema(await getActiveSchema(), () => cronHandler(req));
}
