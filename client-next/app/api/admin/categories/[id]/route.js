export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { categories } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';

const isDup = (e) => e?.code === '23505' || e?.cause?.code === '23505' || e?.message?.includes('duplicate key');

// PATCH { name?, course_id? }
async function patchHandler(req, { params }) {
  try {
    const body = await req.json();
    const updates = {};
    if (body.name !== undefined) {
      const name = String(body.name || '').trim();
      if (!name) return NextResponse.json({ error: 'Category name is required.' }, { status: 400 });
      updates.name = name;
    }
    if (body.course_id !== undefined) updates.courseId = body.course_id || null;
    if (!Object.keys(updates).length) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
    const [row] = await db.update(categories).set(updates).where(eq(categories.id, params.id)).returning({ id: categories.id });
    if (!row) return NextResponse.json({ error: 'Category not found.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (isDup(err)) return NextResponse.json({ error: 'That category already exists for this course.' }, { status: 409 });
    console.error('category PATCH error:', err);
    return NextResponse.json({ error: 'Failed to update category.' }, { status: 500 });
  }
}

// DELETE: skills in it become uncategorised and classes lose their category (FK set null). The UI asks for confirmation first.
async function deleteHandler(req, { params }) {
  try {
    const deleted = await db.delete(categories).where(eq(categories.id, params.id)).returning({ id: categories.id });
    if (!deleted.length) return NextResponse.json({ error: 'Category not found.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('category DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete category.' }, { status: 500 });
  }
}

export const PATCH = withRole(patchHandler, ['admin']);
export const DELETE = withRole(deleteHandler, ['admin']);
