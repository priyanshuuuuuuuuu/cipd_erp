export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { notifications, courses, sessions } from '@/drizzle/schema';
import { eq, and, inArray, count, desc } from 'drizzle-orm';
import { withAuth } from '@/lib/middleware';

// GET - Fetch notifications for the logged-in student
async function handler(req) {
  try {
    const user = req.user;
    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get('unread') === 'true';

    const conditions = [eq(notifications.recipientId, user.id)];
    if (unreadOnly) {
      conditions.push(eq(notifications.isRead, false));
    }

    const rows = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        message: notifications.message,
        is_read: notifications.isRead,
        created_at: notifications.createdAt,
        course_name: courses.name,
        session_title: sessions.title,
        session_date: sessions.sessionDate,
        start_time: sessions.startTime,
      })
      .from(notifications)
      .leftJoin(courses, eq(notifications.courseId, courses.id))
      .leftJoin(sessions, eq(notifications.sessionId, sessions.id))
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    const formatted = rows.map(r => ({
      id: r.id,
      type: r.type,
      title: r.title,
      message: r.message,
      is_read: r.is_read,
      created_at: r.created_at,
      course: r.course_name ? { name: r.course_name } : null,
      session: r.session_title ? { title: r.session_title, session_date: r.session_date, start_time: r.start_time } : null,
    }));

    const [unreadResult] = await db
      .select({ count: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, user.id),
          eq(notifications.isRead, false)
        )
      );

    return NextResponse.json({
      notifications: formatted,
      unread_count: Number(unreadResult?.count || 0),
    });
  } catch (err) {
    console.error('Student notifications error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Mark notifications as read
async function patchHandler(req) {
  try {
    const user = req.user;
    const { notification_ids, mark_all } = await req.json();

    if (mark_all) {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(
          and(
            eq(notifications.recipientId, user.id),
            eq(notifications.isRead, false)
          )
        );
    } else if (notification_ids && notification_ids.length > 0) {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(
          and(
            inArray(notifications.id, notification_ids),
            eq(notifications.recipientId, user.id)
          )
        );
    }

    return NextResponse.json({ message: 'Notifications updated' });
  } catch (err) {
    console.error('Mark read error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
export const PATCH = withAuth(patchHandler);

