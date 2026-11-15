export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { facultyLeave } from '@/drizzle/schema';
import { and, eq } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';

async function handler(req, { params }) {
  try {
    const { status, admin_notes } = await req.json();
    if (!['approved', 'rejected'].includes(status)) return NextResponse.json({ error: 'status must be approved or rejected' }, { status: 400 });

    const updated = await db.update(facultyLeave).set({
      status, adminNotes: String(admin_notes || '').trim() || null, reviewedBy: req.user.id, reviewedAt: new Date().toISOString(),
    }).where(and(eq(facultyLeave.id, params.id), eq(facultyLeave.status, 'pending'))).returning({ id: facultyLeave.id });

    if (!updated.length) {
      const [ex] = await db.select({ status: facultyLeave.status }).from(facultyLeave).where(eq(facultyLeave.id, params.id)).limit(1);
      return ex
        ? NextResponse.json({ error: `Request already ${ex.status}` }, { status: 409 })
        : NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, status });
  } catch (err) {
    console.error('Admin faculty leave decision error:', err);
    return NextResponse.json({ error: 'Failed to update request' }, { status: 500 });
  }
}

export const PATCH = withRole(handler, ['admin']);
