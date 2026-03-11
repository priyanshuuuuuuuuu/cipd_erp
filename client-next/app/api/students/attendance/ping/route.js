export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';

async function handler(req) {
  try {
    const { session_id, device_hash, bssid, signal_strength } = await req.json();

    if (!session_id) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }

    // Verify session exists and is active
    const { data: session } = await supabaseAdmin
      .from('sessions')
      .select('id, status')
      .eq('id', session_id)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Log the ping
    const { error } = await supabaseAdmin
      .from('attendance_ping_logs')
      .insert({
        session_id,
        student_id: req.user.id,
        device_hash: device_hash || null,
        bssid: bssid || null,
        signal_strength: signal_strength || null,
      });

    if (error) {
      console.error('Ping log error:', error);
      return NextResponse.json({ error: 'Failed to log ping' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Ping recorded successfully' });
  } catch (err) {
    console.error('Attendance ping error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withAuth(handler);
