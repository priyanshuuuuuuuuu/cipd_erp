export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

async function handler(req) {
  try {
    // Create notifications table if it doesn't exist
    const { error } = await supabaseAdmin.rpc('exec_sql', {
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
        CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
      `
    });

    if (error) {
      // The rpc might not exist, try raw SQL through a different approach
      // Use the REST API
      console.log('RPC approach failed, table may need to be created manually via SQL Editor:', error.message);
      return NextResponse.json({
        message: 'Please run the SQL from scripts/create_notifications_table.sql in your Supabase SQL Editor',
        error: error.message,
      }, { status: 500 });
    }

    return NextResponse.json({ message: 'Notifications table created successfully' });
  } catch (err) {
    console.error('Setup error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const POST = withRole(handler, ['admin']);
