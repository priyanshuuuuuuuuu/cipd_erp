export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { notificationStream } from '@/drizzle/schema';
import { and, desc, inArray } from 'drizzle-orm';
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

// Delete only messages the worker has not claimed. The status predicate is
// evaluated by PostgreSQL at deletion time, so a concurrent claim wins safely.
async function cancelHandler(req) {
  try {
    const { ids } = await req.json();
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!Array.isArray(ids) || !ids.length || ids.length > 100 || ids.some(id => typeof id !== 'string' || !uuid.test(id))) {
      return NextResponse.json({ error: 'Provide between 1 and 100 valid email IDs.' }, { status: 400 });
    }
    const uniqueIds = [...new Set(ids)];
    const removed = await db.delete(notificationStream)
      .where(and(inArray(notificationStream.id, uniqueIds), inArray(notificationStream.status, ['queued', 'retry'])))
      .returning({ id: notificationStream.id });
    return NextResponse.json({ removed: removed.length, unchanged: uniqueIds.length - removed.length });
  } catch (err) {
    console.error('Email queue cancellation error:', err);
    return NextResponse.json({ error: 'Could not cancel queued emails.' }, { status: 500 });
  }
}

export const DELETE = withRole(cancelHandler, ['admin']);
