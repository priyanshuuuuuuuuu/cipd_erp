export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withRole } from '@/lib/middleware';

async function handler() {
  return NextResponse.json(
    {
      error: 'Notification stream management has moved to notification-service.',
      action: 'Use its protected /messages, /drain, and /messages/:id/retry endpoints.',
    },
    { status: 410 }
  );
}

export const GET = withRole(handler, ['admin']);
export const POST = withRole(handler, ['admin']);

