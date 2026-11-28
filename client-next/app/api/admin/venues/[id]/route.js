export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { venues, sessions } from '@/drizzle/schema';
import { eq, count } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';

// PATCH { name?, building?, is_active? }
async function patchHandler(req, { params }) {
  try {
    const body = await req.json();
    const updates = {};
    if (body.name !== undefined) {
      const name = String(body.name || '').trim();
      if (!name) return NextResponse.json({ error: 'Venue name is required.' }, { status: 400 });
      updates.name = name;
    }
    if (body.building !== undefined) updates.building = String(body.building || '').trim() || null;
    if (body.is_active !== undefined) updates.isActive = !!body.is_active;
    if (!Object.keys(updates).length) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
    const [row] = await db.update(venues).set(updates).where(eq(venues.id, params.id)).returning({ id: venues.id });
    if (!row) return NextResponse.json({ error: 'Venue not found.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('venue PATCH error:', err);
    return NextResponse.json({ error: 'Failed to update venue.' }, { status: 500 });
  }
}

// DELETE: only when no class uses the venue (deactivate it instead otherwise)
async function deleteHandler(req, { params }) {
  try {
    const [{ n }] = await db.select({ n: count() }).from(sessions).where(eq(sessions.venueId, params.id));
    if (Number(n) > 0) {
      return NextResponse.json({ error: `This venue is used by ${n} class${Number(n) === 1 ? '' : 'es'}. Deactivate it instead of deleting.` }, { status: 409 });
    }
    const deleted = await db.delete(venues).where(eq(venues.id, params.id)).returning({ id: venues.id });
    if (!deleted.length) return NextResponse.json({ error: 'Venue not found.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('venue DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete venue.' }, { status: 500 });
  }
}

export const PATCH = withRole(patchHandler, ['admin']);
export const DELETE = withRole(deleteHandler, ['admin']);
