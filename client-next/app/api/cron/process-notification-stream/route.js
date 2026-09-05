export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      error: 'Notification delivery has moved to the standalone notification-service.',
      action: 'Start notification-service instead of calling this Next.js endpoint.',
    },
    { status: 410 }
  );
}

