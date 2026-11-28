export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessionTypes, sessions } from '@/drizzle/schema';
import { eq, count } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';

const isDup = (e) => e?.code === '23505' || e?.cause?.code === '23505' || e?.message?.includes('duplicate key');

// PATCH { name }
async function patchHandler(req, { params }) {
  try {
    const name = String((await req.json()).name || '').trim();
    if (!name) return NextResponse.json({ error: 'Type name is required.' }, { status: 400 });
    const [row] = await db.update(sessionTypes).set({ name }).where(eq(sessionTypes.id, params.id)).returning({ id: sessionTypes.id });
    if (!row) return NextResponse.json({ error: 'Class type not found.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (isDup(err)) return NextResponse.json({ error: 'A type with that name already exists.' }, { status: 409 });
    console.error('session-type PATCH error:', err);
    return NextResponse.json({ error: 'Failed to update class type.' }, { status: 500 });
  }
}

// DELETE: only when no class uses it
async function deleteHandler(req, { params }) {
  try {
    const [{ n }] = await db.select({ n: count() }).from(sessions).where(eq(sessions.sessionTypeId, params.id));
    if (Number(n) > 0) {
      return NextResponse.json({ error: `This class type is used by ${n} class${Number(n) === 1 ? '' : 'es'}, so it cannot be deleted.` }, { status: 409 });
    }
    const deleted = await db.delete(sessionTypes).where(eq(sessionTypes.id, params.id)).returning({ id: sessionTypes.id });
    if (!deleted.length) return NextResponse.json({ error: 'Class type not found.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('session-type DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete class type.' }, { status: 500 });
  }
}

export const PATCH = withRole(patchHandler, ['admin']);
export const DELETE = withRole(deleteHandler, ['admin']);
