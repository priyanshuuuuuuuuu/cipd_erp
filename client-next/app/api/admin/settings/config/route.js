export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { systemSettings } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';

async function handler(req) {
  try {
    if (req.method === 'GET') {
      const [data] = await db
        .select({
          id: systemSettings.id,
          ping_interval: systemSettings.pingInterval,
          pings_per_session: systemSettings.pingsPerSession,
          presence_threshold: systemSettings.presenceThreshold,
          attendance_window: systemSettings.attendanceWindow,
          updated_at: systemSettings.updatedAt,
          scanner_interval_minutes: systemSettings.scannerIntervalMinutes,
          min_signal: systemSettings.minSignal,
        })
        .from(systemSettings)
        .where(eq(systemSettings.id, 1))
        .limit(1);

      return NextResponse.json(data || {});
    } 
    
    if (req.method === 'PUT') {
      const body = await req.json();
      
      const { scannerInterval, minSignal } = body;

      const updatePayload = {
        updatedAt: new Date().toISOString()
      };
      if (scannerInterval !== undefined) {
        updatePayload.scannerIntervalMinutes = scannerInterval;
        updatePayload.pingInterval = scannerInterval; // keep old column in sync
      }
      if (minSignal !== undefined) {
        updatePayload.minSignal = minSignal;
        updatePayload.presenceThreshold = minSignal; // keep old column in sync
      }

      const [data] = await db
        .update(systemSettings)
        .set(updatePayload)
        .where(eq(systemSettings.id, 1))
        .returning({
          id: systemSettings.id,
          ping_interval: systemSettings.pingInterval,
          pings_per_session: systemSettings.pingsPerSession,
          presence_threshold: systemSettings.presenceThreshold,
          attendance_window: systemSettings.attendanceWindow,
          updated_at: systemSettings.updatedAt,
          scanner_interval_minutes: systemSettings.scannerIntervalMinutes,
          min_signal: systemSettings.minSignal,
        });

      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  } catch (err) {
    console.error('Config API error:', err);
    return NextResponse.json({ error: 'Internal server error', message: err.message }, { status: 500 });
  }
}

export const GET = withRole(handler, ['admin']);
export const PUT = withRole(handler, ['admin']);
