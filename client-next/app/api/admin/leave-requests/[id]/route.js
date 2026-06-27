export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
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

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('leave_requests')
      .select('id, student_id, leave_date, status')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
    }

    if (existing.status !== 'pending') {
      return NextResponse.json(
        { error: `Leave request already ${existing.status}` },
        { status: 409 }
      );
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('leave_requests')
      .update({
        status,
        admin_notes: admin_notes?.trim() || null,
        reviewed_by: req.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, student_id, leave_date, status, admin_notes')
      .single();

    if (updateErr) {
      console.error('Leave review error:', updateErr.message);
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
