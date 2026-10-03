export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessions as sessionsTable, attendancePingLogs } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { withAuth } from '@/lib/middleware';

async function handler(req) {
  try {
    const { session_id, device_hash, bssid, signal_strength } = await req.json();

    if (!session_id) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }

    // Verify session exists and is active
    const [session] = await db
      .select({ id: sessionsTable.id, status: sessionsTable.status })
      .from(sessionsTable)
      .where(eq(sessionsTable.id, session_id));

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Log the ping
    await db.insert(attendancePingLogs).values({
      sessionId: session_id,
      studentId: req.user.id,
      deviceHash: device_hash || null,
      bssid: bssid || null,
      signalStrength: signal_strength || null,
    });

    return NextResponse.json({ message: 'Ping recorded successfully' });
  } catch (err) {
    console.error('Attendance ping error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withAuth(handler);
