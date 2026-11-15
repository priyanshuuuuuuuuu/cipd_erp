export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { facultyLeave } from '@/drizzle/schema';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';
import { getISTDateString } from '@/lib/ist-date';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function getHandler(req) {
  try {
    const rows = await db.select().from(facultyLeave)
      .where(eq(facultyLeave.facultyId, req.user.id)).orderBy(desc(facultyLeave.createdAt));
    return NextResponse.json({ leave: rows });
  } catch (err) {
    console.error('Faculty leave list error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function postHandler(req) {
  try {
    const b = await req.json();
    const from = b.from_date; const to = b.to_date || b.from_date;
    const reason = String(b.reason || '').trim();
    if (!DATE_RE.test(from || '') || !DATE_RE.test(to || '')) return NextResponse.json({ error: 'Valid from and to dates are required' }, { status: 400 });
    if (to < from) return NextResponse.json({ error: 'End date cannot be before start date' }, { status: 400 });
    if (from < getISTDateString()) return NextResponse.json({ error: 'Leave cannot start in the past' }, { status: 400 });
    if (!reason || reason.length > 1000) return NextResponse.json({ error: 'A reason is required (max 1000 characters)' }, { status: 400 });

    const [overlap] = await db.select({ id: facultyLeave.id }).from(facultyLeave)
      .where(and(eq(facultyLeave.facultyId, req.user.id), lte(facultyLeave.fromDate, to), gte(facultyLeave.toDate, from))).limit(1);
    if (overlap) return NextResponse.json({ error: 'You already have a leave request overlapping these dates' }, { status: 409 });

    const [created] = await db.insert(facultyLeave).values({ facultyId: req.user.id, fromDate: from, toDate: to, reason }).returning();
    return NextResponse.json({ leave: created }, { status: 201 });
  } catch (err) {
    console.error('Faculty leave create error:', err);
    return NextResponse.json({ error: 'Failed to submit leave request' }, { status: 500 });
  }
}

// Withdraw a still-pending request.
async function deleteHandler(req) {
  try {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const res = await db.delete(facultyLeave)
      .where(and(eq(facultyLeave.id, id), eq(facultyLeave.facultyId, req.user.id), eq(facultyLeave.status, 'pending'))).returning({ id: facultyLeave.id });
    if (!res.length) return NextResponse.json({ error: 'Pending request not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Faculty leave delete error:', err);
    return NextResponse.json({ error: 'Failed to withdraw request' }, { status: 500 });
  }
}

export const GET = withRole(getHandler, ['faculty']);
export const POST = withRole(postHandler, ['faculty']);
export const DELETE = withRole(deleteHandler, ['faculty']);
