export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { leaveRequests } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';
import { notifyStudentLeaveDecision } from '@/lib/leave-notifications';

async function patchHandler(req, { params }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { status, admin_notes } = body;

    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: 'status must be approved or rejected' },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select({
        id: leaveRequests.id,
        student_id: leaveRequests.studentId,
        leave_date: leaveRequests.leaveDate,
        status: leaveRequests.status,
      })
      .from(leaveRequests)
      .where(eq(leaveRequests.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
    }

    if (existing.status !== 'pending') {
      return NextResponse.json(
        { error: `Leave request already ${existing.status}` },
        { status: 409 }
      );
    }

    const [updated] = await db
      .update(leaveRequests)
      .set({
        status,
        adminNotes: admin_notes?.trim() || null,
        reviewedBy: req.user.id,
        reviewedAt: new Date().toISOString(),
      })
      .where(eq(leaveRequests.id, id))
      .returning({
        id: leaveRequests.id,
        student_id: leaveRequests.studentId,
        leave_date: leaveRequests.leaveDate,
        status: leaveRequests.status,
        admin_notes: leaveRequests.adminNotes,
      });

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update leave request' }, { status: 500 });
    }

    await notifyStudentLeaveDecision({
      studentId: existing.student_id,
      leaveDate: existing.leave_date,
      status,
      adminNotes: admin_notes?.trim() || '',
      reviewerId: req.user.id,
    });

    return NextResponse.json({
      message: `Leave request ${status}`,
      request: updated,
    });
  } catch (err) {
    console.error('Leave review PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const PATCH = withRole(patchHandler, ['admin']);
