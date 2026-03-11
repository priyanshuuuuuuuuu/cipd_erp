export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

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

    // Batch insert notifications
    if (notificationsToInsert.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('notifications')
        .insert(notificationsToInsert);

      if (insertError) {
        console.error('Notification insert error:', insertError);
        return NextResponse.json({ error: 'Failed to send notifications: ' + insertError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      message: 'Notifications sent successfully',
      sentAt: new Date().toISOString(),
      type: type || 'general',
      recipientCount: notificationsToInsert.length,
    });
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
