export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { withRole } from '@/lib/middleware';

async function handler(req) {
  try {
    const { type, message, recipients } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    // In a production system, this would integrate with email/push notification services
    // For now, we log the notification and return success
    console.log('Notification sent:', { type, message, recipients, sentAt: new Date().toISOString() });

    return NextResponse.json({
      message: 'Notification sent successfully',
      sentAt: new Date().toISOString(),
      type: type || 'general',
      recipientCount: Array.isArray(recipients) ? recipients.length : 'all',
    });
  } catch (err) {
    console.error('Notification error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withRole(handler, ['admin']);
