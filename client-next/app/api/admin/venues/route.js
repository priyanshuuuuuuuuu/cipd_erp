export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { venues } from '@/drizzle/schema';
import { withRole } from '@/lib/middleware';

// POST — add a new venue (name only; the Wi-Fi router BSSID can be linked later in Settings)
async function postHandler(req) {
  try {
    const { name, building } = await req.json();
    const trimmed = String(name || '').trim();
    if (!trimmed) {
      return NextResponse.json({ error: 'Venue name is required.' }, { status: 400 });
    }

    const [inserted] = await db
      .insert(venues)
      .values({ name: trimmed, building: String(building || '').trim() || null, isActive: true })
      .returning({ id: venues.id, name: venues.name, building: venues.building });

    return NextResponse.json({
      venue: { id: inserted.id, name: `${inserted.name}${inserted.building ? ', ' + inserted.building : ''}` },
    }, { status: 201 });
  } catch (err) {
    console.error('venues POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const POST = withRole(postHandler, ['admin']);
