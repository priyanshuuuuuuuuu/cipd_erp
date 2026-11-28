export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { skills } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';

const isDup = (e) => e?.code === '23505' || e?.cause?.code === '23505' || e?.message?.includes('duplicate key');

// PATCH { name?, details?, category_id? }
async function patchHandler(req, { params }) {
  try {
    const body = await req.json();
    const updates = {};
    if (body.name !== undefined) {
      const name = String(body.name || '').trim();
      if (!name) return NextResponse.json({ error: 'Skill name is required.' }, { status: 400 });
      updates.name = name;
    }
    if (body.details !== undefined) updates.details = String(body.details || '').trim() || null;
    if (body.category_id !== undefined) updates.categoryId = body.category_id || null;
    if (!Object.keys(updates).length) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
    const [row] = await db.update(skills).set(updates).where(eq(skills.id, params.id)).returning({ id: skills.id });
    if (!row) return NextResponse.json({ error: 'Skill not found.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (isDup(err)) return NextResponse.json({ error: 'A skill with this name already exists.' }, { status: 409 });
    console.error('skill PATCH error:', err);
    return NextResponse.json({ error: 'Failed to update skill.' }, { status: 500 });
  }
}

// DELETE: also untags the skill from classes (session_skills rows cascade). The UI asks for confirmation first.
async function deleteHandler(req, { params }) {
  try {
    const deleted = await db.delete(skills).where(eq(skills.id, params.id)).returning({ id: skills.id });
    if (!deleted.length) return NextResponse.json({ error: 'Skill not found.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('skill DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete skill.' }, { status: 500 });
  }
}

export const PATCH = withRole(patchHandler, ['admin']);
export const DELETE = withRole(deleteHandler, ['admin']);
