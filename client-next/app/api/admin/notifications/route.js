export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { notifications, sessions, courses, courseEnrollments, users, venues, faculty, feedbackResponses } from '@/drizzle/schema';
import { eq, and, inArray, gte, lte, ne, desc, count } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';
import { sendWeeklyScheduleEmail, sendGeneralNotificationEmail } from '@/lib/emailer';
import {
  fetchPreferencesMap,
  filterNotificationsByPrefs,
  shouldNotifyUser,
} from '@/lib/should-notify';
import { getISTWeekRange } from '@/lib/ist-date';
import { isNotificationSandboxEnabled, notificationSandboxRecipients } from '@/lib/notification-stream';

// POST - Send notifications (supports feedback reminders, class reminders, general)
async function postHandler(req) {
  try {
    const body = await req.json();
    const { type, message, session_id, session_ids, course_id, recipients } = body;
    const targetSessionIds = session_ids || (session_id ? [session_id] : []);

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    // Get the admin user ID from the request
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    let senderId = null;
    try {
      const { verifyToken } = require('@/lib/auth');
      const decoded = verifyToken(token);
      senderId = decoded?.id || null;
    } catch {}

    let notificationsToInsert = [];

    if (type === 'feedback_reminder') {
      // Send feedback reminders to students with pending feedback
      const feedbackStatusRes = await getFeedbackPendingStudents(targetSessionIds);
      
      for (const item of feedbackStatusRes) {
        for (const pending of item.pending_details) {
          notificationsToInsert.push({
            recipient_id: pending.student_id,
            type: 'feedback_reminder',
            title: `Feedback Pending: ${item.course}`,
            message: `You have pending feedback for ${item.course}. Please submit your feedback to help improve the learning experience.`,
            course_id: item.course_id,
            session_id: pending.session_id,
            sent_by: senderId,
          });
        }
      }
    } else if (type === 'class_reminder' && targetSessionIds.length > 0) {
      // Send class reminder to all enrolled students for these sessions
      const sessionsList = await db
        .select({
          id: sessions.id,
          title: sessions.title,
          course_id: sessions.courseId,
          session_date: sessions.sessionDate,
          start_time: sessions.startTime,
          venue_name: venues.name,
          course_name: courses.name,
        })
        .from(sessions)
        .leftJoin(venues, eq(sessions.venueId, venues.id))
        .leftJoin(courses, eq(sessions.courseId, courses.id))
        .where(inArray(sessions.id, targetSessionIds));

      if (!sessionsList || sessionsList.length === 0) {
        return NextResponse.json({ error: 'Sessions not found' }, { status: 404 });
      }

      const courseIds = [...new Set(sessionsList.map(s => s.course_id).filter(Boolean))];

      const enrollments = await db
        .select({ student_id: courseEnrollments.studentId, course_id: courseEnrollments.courseId })
        .from(courseEnrollments)
        .where(inArray(courseEnrollments.courseId, courseIds));

      const enrollmentsByCourse = {};
      for (const e of enrollments || []) {
        if (!e.course_id || !e.student_id) continue;
        if (!enrollmentsByCourse[e.course_id]) enrollmentsByCourse[e.course_id] = [];
        enrollmentsByCourse[e.course_id].push(e.student_id);
      }

      for (const session of sessionsList) {
        const enrolledStudents = enrollmentsByCourse[session.course_id] || [];
        for (const studentId of enrolledStudents) {
          notificationsToInsert.push({
            recipient_id: studentId,
            type: 'class_reminder',
            title: `Class Reminder: ${session.course_name || session.title}`,
            message: message || `Reminder: ${session.title} is scheduled for ${session.session_date} at ${session.start_time?.slice(0, 5)} in ${session.venue_name || 'TBA'}. Please attend.`,
            course_id: session.course_id,
            session_id: session.id,
            sent_by: senderId,
          });
        }
      }
    } else if (recipients && Array.isArray(recipients) && recipients.length > 0) {
      // Send to specified recipients
      for (const recipientId of recipients) {
        notificationsToInsert.push({
          recipient_id: recipientId,
          type: type || 'general',
          title: body.title || 'Notification',
          message,
          course_id: course_id || null,
          session_id: session_id || null,
          sent_by: senderId,
        });
      }
    } else {
      // Send to all active students
      const studentUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.role, 'student'), eq(users.isActive, true)));

      for (const student of (studentUsers || [])) {
        notificationsToInsert.push({
          recipient_id: student.id,
          type: type || 'general',
          title: body.title || 'Notification',
          message,
          sent_by: senderId,
        });
      }
    }

    const notifType = type || 'general';
    // Save full recipient list BEFORE preference filtering — the email block needs it
    const allRecipientIds = notificationsToInsert.map((n) => n.recipient_id).filter(Boolean);
    const prefMap = await fetchPreferencesMap(allRecipientIds);
    notificationsToInsert = filterNotificationsByPrefs(notificationsToInsert, prefMap, notifType);

    // Batch insert notifications into DB
    if (notificationsToInsert.length > 0) {
      const insertValues = notificationsToInsert.map(n => ({
        recipientId: n.recipient_id,
        type: n.type,
        title: n.title,
        message: n.message,
        courseId: n.course_id,
        sessionId: n.session_id,
        sentBy: n.sent_by,
      }));
      await db.insert(notifications).values(insertValues);
    }

    // ── Respond immediately — email sending happens in background ─────────
    const response = NextResponse.json({
      message: 'Notifications sent successfully',
      sentAt: new Date().toISOString(),
      type: type || 'general',
      recipientCount: notificationsToInsert.length,
      emailsQueued: true,
    });

    // Fire-and-forget: send emails in background without blocking the response
    if (type === 'class_reminder' && targetSessionIds.length > 0) {
      (async () => {
        try {
          console.log(`[EMAIL DEBUG] class_reminder background started for session_ids=${targetSessionIds.join(',')}`);
          const bgSessions = await db
            .select({
              id: sessions.id,
              course_id: sessions.courseId,
              title: sessions.title,
              session_date: sessions.sessionDate,
              start_time: sessions.startTime,
              venue_name: venues.name,
              course_name: courses.name,
            })
            .from(sessions)
            .leftJoin(venues, eq(sessions.venueId, venues.id))
            .leftJoin(courses, eq(sessions.courseId, courses.id))
            .where(inArray(sessions.id, targetSessionIds));

          const courseIds = [...new Set((bgSessions || []).map(s => s.course_id).filter(Boolean))];
          if (courseIds.length === 0) {
            console.log('[EMAIL DEBUG] ❌ No course_ids found for sessions — aborting');
            return;
          }
          console.log(`[EMAIL DEBUG] course_ids=${courseIds.join(',')}`);

          let studentIds;
          if (recipients && Array.isArray(recipients) && recipients.length > 0) {
            studentIds = recipients;
            console.log(`[EMAIL DEBUG] Using specified recipients: ${studentIds.join(',')}`);
          } else {
            const enrollments = await db
              .select({ student_id: courseEnrollments.studentId })
              .from(courseEnrollments)
              .where(inArray(courseEnrollments.courseId, courseIds));
            studentIds = [...new Set((enrollments || []).map(e => e.student_id).filter(Boolean))];
            console.log(`[EMAIL DEBUG] enrolled students found: ${studentIds.length}`);
          }

          if (studentIds.length === 0) {
            console.log('[EMAIL DEBUG] ❌ 0 students to notify — no emails sent.');
            return;
          }

          const studentUsers = await db
            .select({
              id: users.id,
              first_name: users.firstName,
              last_name: users.lastName,
              email: users.email,
            })
            .from(users)
            .where(and(
              inArray(users.id, studentIds),
              eq(users.isActive, true)
            ));

          const emailPrefMap = await fetchPreferencesMap((studentUsers || []).map((s) => s.id));

          const isSandbox = isNotificationSandboxEnabled();
          const sandboxEmails = isSandbox ? notificationSandboxRecipients() : [];

          // ── TARGETED send ───────────────────────────────────────────────────
          if (recipients && Array.isArray(recipients) && recipients.length > 0) {
            const sessionList = bgSessions || [];
            const sessionSummary = sessionList
              .map(s => `${s.course_name || s.title} on ${s.session_date} at ${s.start_time?.slice(0, 5)} (${s.venue_name || 'TBA'})`)
              .join(', ');
            const notifTitle = `Class Reminder: ${sessionList.length === 1 ? (sessionList[0].course_name || sessionList[0].title) : 'Multiple Classes'}`;
            const emailMessage = `${message}\n\nClass details: ${sessionSummary}`;

            let studentListToProcess = studentUsers || [];
            if (isSandbox) {
              studentListToProcess = studentListToProcess.slice(0, 1);
            }

            const BATCH_SIZE = 5;
            const BATCH_DELAY_MS = 500;
            for (let i = 0; i < studentListToProcess.length; i += BATCH_SIZE) {
              const batch = studentListToProcess.slice(i, i + BATCH_SIZE);
              await Promise.allSettled(
                batch.map(async (student) => {
                  try {
                    const prefAllowed = isSandbox || shouldNotifyUser(emailPrefMap, student.id, 'class_reminder');
                    if (!prefAllowed) {
                      console.log(`[EMAIL DEBUG] ⚠ ${student.email} blocked by notification preferences`);
                      return;
                    }
                    const name = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';
                    const targetEmail = isSandbox ? sandboxEmails[0] : student.email;
                    await sendGeneralNotificationEmail(targetEmail, name, notifTitle, emailMessage, 'class_reminder');
                    console.log(`✉ ${isSandbox ? '[SANDBOX] ' : ''}Targeted class reminder email sent to ${student.email}`);
                  } catch (emailErr) {
                    console.error(`Email failed for ${student.email}:`, emailErr.message);
                  }
                })
              );
              if (i + BATCH_SIZE < studentListToProcess.length) {
                await new Promise(res => setTimeout(res, BATCH_DELAY_MS));
              }
            }
            console.log('[EMAIL DEBUG] ✅ targeted class_reminder email block complete');
            return;
          }

          // ── BROADCAST send: all enrolled students → weekly schedule email ─────
          const { start: startStr, end: endStr } = getISTWeekRange();

          const allEnrollments = await db
            .select({ student_id: courseEnrollments.studentId, course_id: courseEnrollments.courseId })
            .from(courseEnrollments)
            .where(inArray(courseEnrollments.studentId, studentIds));

          const studentCourseMap = {};
          for (const e of (allEnrollments || [])) {
            if (!e.student_id || !e.course_id) continue;
            if (!studentCourseMap[e.student_id]) studentCourseMap[e.student_id] = [];
            studentCourseMap[e.student_id].push(e.course_id);
          }

          const allCourseIds = [...new Set((allEnrollments || []).map(e => e.course_id).filter(Boolean))];

          const weekSessionsRows = await db
            .select({
              id: sessions.id,
              title: sessions.title,
              session_date: sessions.sessionDate,
              start_time: sessions.startTime,
              end_time: sessions.endTime,
              course_id: sessions.courseId,
              course_name: courses.name,
              faculty_first_name: users.firstName,
              faculty_last_name: users.lastName,
              venue_name: venues.name,
              venue_building: venues.building,
            })
            .from(sessions)
            .leftJoin(courses, eq(sessions.courseId, courses.id))
            .leftJoin(faculty, eq(sessions.facultyId, faculty.id))
            .leftJoin(users, eq(faculty.id, users.id))
            .leftJoin(venues, eq(sessions.venueId, venues.id))
            .where(and(
              inArray(sessions.courseId, allCourseIds),
              gte(sessions.sessionDate, startStr),
              lte(sessions.sessionDate, endStr),
              ne(sessions.status, 'cancelled')
            ))
            .orderBy(sessions.sessionDate, sessions.startTime);

          const weekSessions = weekSessionsRows.map(s => ({
            id: s.id,
            title: s.title,
            session_date: s.session_date,
            start_time: s.start_time,
            end_time: s.end_time,
            course_id: s.course_id,
            courses: { name: s.course_name },
            faculty: { users: { first_name: s.faculty_first_name, last_name: s.faculty_last_name } },
            venues: { name: s.venue_name, building: s.venue_building },
          }));

          console.log(`[EMAIL DEBUG] active student users found: ${(studentUsers || []).length}`);
          console.log(`[EMAIL DEBUG] week range: ${startStr} → ${endStr}`);
          console.log(`[EMAIL DEBUG] week sessions found: ${weekSessions.length}`);

          let studentListToProcess = studentUsers || [];
          if (isSandbox) {
            const validStudent = studentListToProcess.find(student => {
              const myCourseIds = studentCourseMap[student.id] || [];
              const mySessions = weekSessions.filter(s => myCourseIds.includes(s.course_id));
              return mySessions.length > 0;
            });
            studentListToProcess = validStudent ? [validStudent] : [];
          }

          const BATCH_SIZE = 5;
          const BATCH_DELAY_MS = 500;
          for (let i = 0; i < studentListToProcess.length; i += BATCH_SIZE) {
            const batch = studentListToProcess.slice(i, i + BATCH_SIZE);
            await Promise.allSettled(
              batch.map(async (student) => {
                try {
                  const prefAllowed = isSandbox || shouldNotifyUser(emailPrefMap, student.id, 'class_reminder');
                  if (!prefAllowed) {
                    console.log(`[EMAIL DEBUG] ⚠ ${student.email} blocked by notification preferences`);
                    return;
                  }
                  const myCourseIds = studentCourseMap[student.id] || [];
                  const mySessions = weekSessions.filter(s => myCourseIds.includes(s.course_id));
                  if (mySessions.length === 0) {
                    console.log(`[EMAIL DEBUG] ⚠ No sessions this week for ${student.email}`);
                    return;
                  }
                  const name = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';
                  
                  if (isSandbox) {
                    for (const sEmail of sandboxEmails) {
                      await sendWeeklyScheduleEmail(sEmail, name + ' (Sandbox)', mySessions);
                      console.log(`✉ [SANDBOX] Weekly schedule email meant for ${student.email} sent to ${sEmail}`);
                    }
                  } else {
                    await sendWeeklyScheduleEmail(student.email, name, mySessions);
                    console.log(`✉ Weekly schedule email sent to ${student.email}`);
                  }
                } catch (emailErr) {
                  console.error(`Email failed for ${student.email}:`, emailErr.message);
                }
              })
            );
            if (i + BATCH_SIZE < studentListToProcess.length) {
              await new Promise(res => setTimeout(res, BATCH_DELAY_MS));
            }
          }
          console.log('[EMAIL DEBUG] ✅ class_reminder email block complete');
        } catch (bgErr) {
          console.error('Background email error:', bgErr.message);
        }
      })();
    }

    // ── General email for all other types sent from compose panel ────────────
    if (targetSessionIds.length === 0) {
      (async () => {
        try {
          console.log(`[EMAIL DEBUG] general email background started, type=${notifType}`);
          
          const isSandbox = isNotificationSandboxEnabled();
          const sandboxEmails = isSandbox ? notificationSandboxRecipients() : [];
          const notifTitle = body?.title || (type || 'general').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

          if (isSandbox) {
            console.log(`[EMAIL DEBUG] Sandbox mode enabled. Sending only to sandbox recipients.`);
            for (const sEmail of sandboxEmails) {
              try {
                await sendGeneralNotificationEmail(sEmail, 'Sandbox Tester', notifTitle, message, type || 'general');
                console.log(`✉ [SANDBOX] General notification email sent to ${sEmail}`);
              } catch (emailErr) {
                console.error(`Email failed for ${sEmail}:`, emailErr.message);
              }
            }
            return;
          }

          let targetStudents = [];
          const emailRecipientIds = [...new Set(allRecipientIds)];

          if (emailRecipientIds.length > 0) {
            targetStudents = await db
              .select({ id: users.id, first_name: users.firstName, last_name: users.lastName, email: users.email })
              .from(users)
              .where(and(inArray(users.id, emailRecipientIds), eq(users.isActive, true)));
          } else {
            targetStudents = await db
              .select({ id: users.id, first_name: users.firstName, last_name: users.lastName, email: users.email })
              .from(users)
              .where(and(eq(users.role, 'student'), eq(users.isActive, true)));
          }

          const generalPrefMap = prefMap.size > 0
            ? prefMap
            : await fetchPreferencesMap(targetStudents.map((s) => s.id));

          const BATCH_SIZE = 5;
          const BATCH_DELAY_MS = 500;
          for (let i = 0; i < targetStudents.length; i += BATCH_SIZE) {
            const batch = targetStudents.slice(i, i + BATCH_SIZE);
            await Promise.allSettled(
              batch.map(async (student) => {
                try {
                  if (!shouldNotifyUser(generalPrefMap, student.id, notifType)) return;
                  const name = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';
                  await sendGeneralNotificationEmail(student.email, name, notifTitle, message, type || 'general');
                  console.log(`✉ General notification email sent to ${student.email}`);
                } catch (emailErr) {
                  console.error(`Email failed for ${student.email}:`, emailErr.message);
                }
              })
            );
            if (i + BATCH_SIZE < targetStudents.length) {
              await new Promise(res => setTimeout(res, BATCH_DELAY_MS));
            }
          }
        } catch (bgErr) {
          console.error('Background general email error:', bgErr.message);
        }
      })();
    }

    return response;
  } catch (err) {
    console.error('Notification error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET - Fetch notification history for admin
async function getHandler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const limitNum = parseInt(searchParams.get('limit') || '50');
    const typeParam = searchParams.get('type');

    let conditions = [];
    if (typeParam) {
      conditions.push(eq(notifications.type, typeParam));
    }

    const rows = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        message: notifications.message,
        is_read: notifications.isRead,
        created_at: notifications.createdAt,
        sent_by: notifications.sentBy,
        recipient_first_name: users.firstName,
        recipient_last_name: users.lastName,
        recipient_email: users.email,
        course_name: courses.name,
      })
      .from(notifications)
      .leftJoin(users, eq(notifications.recipientId, users.id))
      .leftJoin(courses, eq(notifications.courseId, courses.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(notifications.createdAt))
      .limit(limitNum);

    const senderIds = [...new Set(rows.map(r => r.sent_by).filter(Boolean))];
    let senderMap = {};
    if (senderIds.length > 0) {
      const senderRows = await db
        .select({ id: users.id, first_name: users.firstName, last_name: users.lastName })
        .from(users)
        .where(inArray(users.id, senderIds));
      senderRows.forEach(s => { senderMap[s.id] = s; });
    }

    const formattedNotifications = rows.map(r => ({
      id: r.id,
      type: r.type,
      title: r.title,
      message: r.message,
      is_read: r.is_read,
      created_at: r.created_at,
      recipient: r.recipient_email ? {
        first_name: r.recipient_first_name,
        last_name: r.recipient_last_name,
        email: r.recipient_email,
      } : null,
      course: r.course_name ? { name: r.course_name } : null,
      sender: r.sent_by ? (senderMap[r.sent_by] || null) : null,
    }));

    const [{ value: totalSent }] = await db.select({ value: count() }).from(notifications);
    const [{ value: unread }] = await db.select({ value: count() }).from(notifications).where(eq(notifications.isRead, false));

    return NextResponse.json({
      notifications: formattedNotifications,
      stats: {
        total_sent: Number(totalSent || 0),
        unread: Number(unread || 0),
      },
    });
  } catch (err) {
    console.error('Notification fetch error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper: Get all students with pending feedback per course
async function getFeedbackPendingStudents(targetSessionIds = []) {
  const courseList = await db.select({ id: courses.id, name: courses.name }).from(courses);
  if (!courseList || courseList.length === 0) return [];

  const result = [];

  for (const course of courseList) {
    const [{ value: totalEnrolled }] = await db
      .select({ value: count() })
      .from(courseEnrollments)
      .where(eq(courseEnrollments.courseId, course.id));

    let sessionConditions = [
      eq(sessions.courseId, course.id),
      eq(sessions.status, 'completed'),
    ];

    if (targetSessionIds.length > 0) {
      sessionConditions.push(inArray(sessions.id, targetSessionIds));
    }

    const sessionList = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(...sessionConditions));

    if (!sessionList || sessionList.length === 0 || !totalEnrolled) continue;

    const sessionIds = sessionList.map(s => s.id);

    const feedbackSubmissions = await db
      .select({ student_id: feedbackResponses.studentId, session_id: feedbackResponses.sessionId })
      .from(feedbackResponses)
      .where(inArray(feedbackResponses.sessionId, sessionIds));

    const submittedPairs = new Set(
      (feedbackSubmissions || []).map(f => `${f.session_id}::${f.student_id}`)
    );

    const enrolledStudents = await db
      .select({ student_id: courseEnrollments.studentId })
      .from(courseEnrollments)
      .where(eq(courseEnrollments.courseId, course.id));

    const pendingDetails = [];
    for (const session of sessionList) {
      for (const enrollment of (enrolledStudents || [])) {
        if (!enrollment.student_id) continue;
        const key = `${session.id}::${enrollment.student_id}`;
        if (!submittedPairs.has(key)) {
          pendingDetails.push({
            session_id: session.id,
            student_id: enrollment.student_id,
          });
        }
      }
    }

    if (pendingDetails.length > 0) {
      result.push({
        course: course.name,
        course_id: course.id,
        pending_details: pendingDetails,
      });
    }
  }

  return result;
}

export const POST = withRole(postHandler, ['admin']);
export const GET = withRole(getHandler, ['admin']);
