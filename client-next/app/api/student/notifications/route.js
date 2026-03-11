export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';

// GET - Fetch notifications for the logged-in student
async function handler(req) {
  try {
    const user = req.user;
    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get('unread') === 'true';

    let query = supabaseAdmin
      .from('notifications')
      .select(`
        id, type, title, message, is_read, created_at,
        course:course_id ( name ),
        session:session_id ( title, session_date, start_time )
      `)
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data: notifications, error } = await query;

    if (error) {
      console.error('Student notifications error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { count: unreadCount } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .eq('is_read', false);

    return NextResponse.json({
      notifications: notifications || [],
      unread_count: unreadCount || 0,
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
      await supabaseAdmin
        .from('notifications')
        .update({ is_read: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false);
    } else if (notification_ids && notification_ids.length > 0) {
      await supabaseAdmin
        .from('notifications')
        .update({ is_read: true })
        .in('id', notification_ids)
        .eq('recipient_id', user.id);
    }

    return NextResponse.json({ message: 'Notifications updated' });
  } catch (err) {
    console.error('Mark read error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
export const PATCH = withAuth(patchHandler);
