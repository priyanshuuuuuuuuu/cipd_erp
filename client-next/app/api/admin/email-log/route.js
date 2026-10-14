export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { notificationStream } from '@/drizzle/schema';
import { desc } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';

// Live email delivery log: one row per queued email with its current status.
async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10) || 100, 1), 100);

    const rows = await db
      .select({
        id: notificationStream.id,
        dedupe_key: notificationStream.dedupeKey,
        event_type: notificationStream.eventType,
        recipient_email: notificationStream.recipientEmail,
        recipient_name: notificationStream.recipientName,
        status: notificationStream.status,
        attempts: notificationStream.attempts,
        last_error: notificationStream.lastError,
        provider_message_id: notificationStream.providerMessageId,
        created_at: notificationStream.createdAt,
        sent_at: notificationStream.sentAt,
        updated_at: notificationStream.updatedAt,
      })
      .from(notificationStream)
      .orderBy(desc(notificationStream.createdAt))
      .limit(limit);

    return NextResponse.json({ messages: rows });
  } catch (err) {
    console.error('Email log error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(handler, ['admin']);
