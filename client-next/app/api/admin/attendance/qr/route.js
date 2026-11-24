export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { withRole } from '@/lib/middleware';
import { qrPhase, qrSession } from '@/lib/qr-attendance';
import { makeQrAttendanceToken, qrRotationIntervalMs } from '@/lib/qr-attendance-token.mjs';

async function handler(req) {
  try {
    const sessionId = new URL(req.url).searchParams.get('session_id');
    if (!/^[0-9a-f-]{36}$/i.test(sessionId || '')) return NextResponse.json({ error: 'Invalid session.' }, { status: 400 });
    const session = await qrSession(req.cohort, sessionId);
    if (!session) return NextResponse.json({ error: 'Class not found.' }, { status: 404 });
    const phase = qrPhase(session);
    if (!phase) return NextResponse.json({ error: 'QR is available from 5 minutes before class until it starts, and for 15 minutes after class ends.' }, { status: 409 });
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is missing');
    const now = Date.now();
    const interval = qrRotationIntervalMs();
    return NextResponse.json({ token: makeQrAttendanceToken(process.env.JWT_SECRET, req.cohort, sessionId, phase, now), phase, expiresAt: interval ? (Math.floor(now / interval) + 1) * interval : null, rotationSeconds: interval ? interval / 1000 : null });
  } catch (error) {
    console.error('QR display error:', error);
    return NextResponse.json({ error: 'Could not generate attendance QR.' }, { status: 500 });
  }
}

export const GET = withRole(handler, ['admin']);
