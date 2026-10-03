export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';

async function handler(req) {
  try {
    // Create notifications table if it doesn't exist
    await db.execute(sql`
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
      CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
    `);

    return NextResponse.json({ message: 'Notifications table created successfully' });
  } catch (err) {
    console.error('Setup error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const POST = withRole(handler, ['admin']);

