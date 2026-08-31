export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';
import { sendWeeklyScheduleEmail, sendGeneralNotificationEmail } from '@/lib/emailer';
import {
  fetchPreferencesMap,
  filterNotificationsByPrefs,
  shouldNotifyUser,
} from '@/lib/should-notify';
import { getISTWeekRange } from '@/lib/ist-date';


// POST - Send notifications (supports feedback reminders, class reminders, general)
async function postHandler(req) {
  try {
    const body = await req.json();
    const { type, message, session_id, course_id, recipients } = body;

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    // Ensure notifications table exists
    await ensureNotificationsTable();

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
      // Get the pending details from feedback status
      const feedbackStatusRes = await getFeedbackPendingStudents();
      
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
    } else if (type === 'class_reminder' && session_id) {
      // Send class reminder to all enrolled students
      const { data: session } = await supabaseAdmin
        .from('sessions')
        .select('id, title, course_id, session_date, start_time, venues ( name ), courses ( name )')
        .eq('id', session_id)
        .single();

      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      const { data: enrollments } = await supabaseAdmin
        .from('course_enrollments')
        .select('student_id')
        .eq('course_id', session.course_id);

      for (const enrollment of (enrollments || [])) {
        notificationsToInsert.push({
          recipient_id: enrollment.student_id,
          type: 'class_reminder',
          title: `Class Reminder: ${session.courses?.name || session.title}`,
          message: message || `Reminder: ${session.title} is scheduled for ${session.session_date} at ${session.start_time?.slice(0, 5)} in ${session.venues?.name || 'TBA'}. Please attend.`,
          course_id: session.course_id,
          session_id: session_id,
          sent_by: senderId,
        });
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
      const { data: students } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('role', 'student')
        .eq('is_active', true);

      for (const student of (students || [])) {
        notificationsToInsert.push({
          recipient_id: student.id,
          type: type || 'general',
          title: body.title || 'Notification',
          message,
          sent_by: senderId,
        });
      }
    }
    // commit

    const notifType = type || 'general';
    // Save full recipient list BEFORE preference filtering — the email block needs it
    const allRecipientIds = notificationsToInsert.map((n) => n.recipient_id).filter(Boolean);
    const prefMap = await fetchPreferencesMap(supabaseAdmin, allRecipientIds);
    notificationsToInsert = filterNotificationsByPrefs(notificationsToInsert, prefMap, notifType);

    // Batch insert notifications into DB
    if (notificationsToInsert.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('notifications')
        .insert(notificationsToInsert);

      if (insertError) {
        console.error('Notification insert error:', insertError);
        return NextResponse.json({ error: 'Failed to send notifications: ' + insertError.message }, { status: 500 });
      }
    }

    // ── Respond immediately — email sending happens in background ─────────
    // This makes "Notify All" respond instantly (< 1s) instead of waiting
    // for all SMTP calls to complete.
    const response = NextResponse.json({
      message: 'Notifications sent successfully',
      sentAt: new Date().toISOString(),
      type: type || 'general',
      recipientCount: notificationsToInsert.length,
      emailsQueued: true,
    });

    // Fire-and-forget: send emails in background without blocking the response
    if (type === 'class_reminder' && session_id) {
      (async () => {
        try {
          console.log(`[EMAIL DEBUG] class_reminder background started for session_id=${session_id}`);
          const { data: session } = await supabaseAdmin
            .from('sessions')
            .select('course_id')
            .eq('id', session_id)
            .single();

          const courseId = session?.course_id;
          if (!courseId) {
            console.log('[EMAIL DEBUG] ❌ No course_id found for session — aborting');
            return;
          }
          console.log(`[EMAIL DEBUG] course_id=${courseId}`);

          const { data: enrollments } = await supabaseAdmin
            .from('course_enrollments')
            .select('student_id')
            .eq('course_id', courseId);

          const studentIds = (enrollments || []).map(e => e.student_id);
          console.log(`[EMAIL DEBUG] enrolled students found: ${studentIds.length}`);
          if (studentIds.length === 0) {
            console.log('[EMAIL DEBUG] ❌ 0 students enrolled in this course — no emails sent. Enroll students first!');
            return;
          }

          const { data: studentUsers } = await supabaseAdmin
            .from('users')
            .select('id, first_name, last_name, email')
            .in('id', studentIds)
            .eq('is_active', true);

          const emailPrefMap = await fetchPreferencesMap(
            supabaseAdmin,
            (studentUsers || []).map((s) => s.id)
          );

          // Week date range (IST)
          const { start: startStr, end: endStr } = getISTWeekRange();

          // Get all enrollments for these students
          const { data: allEnrollments } = await supabaseAdmin
            .from('course_enrollments')
            .select('student_id, course_id')
            .in('student_id', studentIds);

          const studentCourseMap = {};
          for (const e of (allEnrollments || [])) {
            if (!studentCourseMap[e.student_id]) studentCourseMap[e.student_id] = [];
            studentCourseMap[e.student_id].push(e.course_id);
          }

          const allCourseIds = [...new Set((allEnrollments || []).map(e => e.course_id))];

          const { data: weekSessions } = await supabaseAdmin
            .from('sessions')
            .select(`
              id, title, session_date, start_time, end_time, course_id,
              courses ( name ),
              faculty ( id, users ( first_name, last_name ) ),
              venues ( name, building )
            `)
            .in('course_id', allCourseIds)
            .gte('session_date', startStr)
            .lte('session_date', endStr)
            .neq('status', 'cancelled')
            .order('session_date')
            .order('start_time');

          console.log(`[EMAIL DEBUG] active student users found: ${(studentUsers || []).length}`);
          console.log(`[EMAIL DEBUG] week range: ${startStr} → ${endStr}`);
          console.log(`[EMAIL DEBUG] week sessions found: ${(weekSessions || []).length}`);

          // Send in batches of 5 to avoid Gmail 421 rate-limit errors
          const BATCH_SIZE = 5;
          const BATCH_DELAY_MS = 500;
          const studentList = studentUsers || [];
          for (let i = 0; i < studentList.length; i += BATCH_SIZE) {
            const batch = studentList.slice(i, i + BATCH_SIZE);
            await Promise.allSettled(
              batch.map(async (student) => {
                try {
                  const prefAllowed = shouldNotifyUser(emailPrefMap, student.id, 'class_reminder');
                  if (!prefAllowed) {
                    console.log(`[EMAIL DEBUG] ⚠ ${student.email} blocked by notification preferences`);
                    return;
                  }
                  const myCourseIds = studentCourseMap[student.id] || [];
                  const mySessions = (weekSessions || []).filter(s => myCourseIds.includes(s.course_id));
                  if (mySessions.length === 0) {
                    console.log(`[EMAIL DEBUG] ⚠ No sessions this week for ${student.email}`);
                    return;
                  }
                  const name = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';
                  await sendWeeklyScheduleEmail(student.email, name, mySessions);
                  console.log(`✉ Weekly schedule email sent to ${student.email}`);
                } catch (emailErr) {
                  console.error(`Email failed for ${student.email}:`, emailErr.message);
                }
              })
            );
            // Pause between batches to respect Gmail sending limits
            if (i + BATCH_SIZE < studentList.length) {
              await new Promise(res => setTimeout(res, BATCH_DELAY_MS));
            }
          }
          console.log('[EMAIL DEBUG] ✅ class_reminder email block complete');
        } catch (bgErr) {
          console.error('Background email error:', bgErr.message);
        }
      })(); // immediately invoked — does NOT block the response above
    }

    // ── General email for all other types sent from compose panel ────────────
    if (!session_id) {
      (async () => {
        try {
          console.log(`[EMAIL DEBUG] general email background started, type=${notifType}`);
          // Collect target student list
          let targetStudents = [];

          // Use allRecipientIds (pre-filter) so emails are never silently dropped
          // even if notificationsToInsert was filtered to 0 by prefs
          const emailRecipientIds = [...new Set(allRecipientIds)];

          if (emailRecipientIds.length > 0) {
            const { data } = await supabaseAdmin
              .from('users')
              .select('id, first_name, last_name, email')
              .in('id', emailRecipientIds)
              .eq('is_active', true);
            targetStudents = data || [];
          } else {
            // Fallback: send to all active students (broadcast)
            const { data } = await supabaseAdmin
              .from('users')
              .select('id, first_name, last_name, email')
              .eq('role', 'student')
              .eq('is_active', true);
            targetStudents = data || [];
          }

          const notifTitle = body?.title || (type || 'general').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

          const generalPrefMap = prefMap.size > 0
            ? prefMap
            : await fetchPreferencesMap(supabaseAdmin, targetStudents.map((s) => s.id));

          // Send in batches of 5 to avoid Gmail 421 rate-limit errors
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
    await ensureNotificationsTable();

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const type = searchParams.get('type');

    let query = supabaseAdmin
      .from('notifications')
      .select(`
        id, type, title, message, is_read, created_at,
        recipient:recipient_id ( first_name, last_name, email ),
        course:course_id ( name ),
        sender:sent_by ( first_name, last_name )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (type) query = query.eq('type', type);

    const { data: notifications, error } = await query;

    if (error) {
      console.error('Notification fetch error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get stats
    const { count: totalSent } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true });

    const { count: unread } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false);

    return NextResponse.json({
      notifications: notifications || [],
      stats: {
        total_sent: totalSent || 0,
        unread: unread || 0,
      },
    });
  } catch (err) {
    console.error('Notification fetch error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper: Get all students with pending feedback per course
async function getFeedbackPendingStudents() {
  const { data: courses } = await supabaseAdmin
    .from('courses')
    .select('id, name');

  if (!courses) return [];

  const result = [];

  for (const course of courses) {
    const { count: totalEnrolled } = await supabaseAdmin
      .from('course_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('course_id', course.id);

    const { data: sessions } = await supabaseAdmin
      .from('sessions')
      .select('id')
      .eq('course_id', course.id)
      .eq('status', 'completed');

    if (!sessions || sessions.length === 0 || !totalEnrolled) continue;

    const sessionIds = sessions.map(s => s.id);

    const { data: feedbackSubmissions } = await supabaseAdmin
      .from('feedback_responses')
      .select('student_id, session_id')
      .in('session_id', sessionIds);

    const submittedPairs = new Set(
      (feedbackSubmissions || []).map(f => `${f.session_id}::${f.student_id}`)
    );

    const { data: enrolledStudents } = await supabaseAdmin
      .from('course_enrollments')
      .select('student_id')
      .eq('course_id', course.id);

    const pendingDetails = [];
    for (const session of sessions) {
      for (const enrollment of (enrolledStudents || [])) {
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

// Helper: Ensure notifications table exists
async function ensureNotificationsTable() {
  try {
    const { error } = await supabaseAdmin.from('notifications').select('id').limit(1);
    if (error && error.code === '42P01') {
      // Table doesn't exist, create it
      await supabaseAdmin.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS notifications (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
            type TEXT NOT NULL DEFAULT 'general',
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            course_id UUID REFERENCES courses(id),
            session_id UUID REFERENCES sessions(id),
            is_read BOOLEAN DEFAULT FALSE,
            sent_by UUID REFERENCES users(id),
            created_at TIMESTAMP DEFAULT now()
          );
          CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);
          CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(recipient_id, is_read);
        `
      });
    }
  } catch (e) {
    // Table might already exist, that's fine
  }
}

export const POST = withRole(postHandler, ['admin']);
export const GET = withRole(getHandler, ['admin']);
