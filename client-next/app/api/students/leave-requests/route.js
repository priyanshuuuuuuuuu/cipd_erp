export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';
import { notifyAdminsOfLeaveRequest } from '@/lib/leave-notifications';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function getHandler(req) {
  try {
    const { data, error } = await supabaseAdmin
      .from('leave_requests')
      .select(`
        id, leave_date, session_id, reason, status, admin_notes, created_at, reviewed_at,
        sessions ( id, title, start_time, end_time, courses ( name ) )
      `)
      .eq('student_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Leave requests fetch error:', error.message);
      return NextResponse.json({ error: 'Failed to fetch leave requests' }, { status: 500 });
    }

    return NextResponse.json({ requests: data || [] });
  } catch (err) {
    console.error('Leave requests GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function postHandler(req) {
  try {
    const body = await req.json();
    const { leave_date, session_id, reason } = body;

    if (!leave_date || !DATE_RE.test(leave_date)) {
      return NextResponse.json(
        { error: 'leave_date is required (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      return NextResponse.json(
        { error: 'reason is required (min 5 characters)' },
        { status: 400 }
      );
    }

    if (session_id) {
      const { data: session } = await supabaseAdmin
        .from('sessions')
        .select('id, session_date, title')
        .eq('id', session_id)
        .single();

      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      if (session.session_date !== leave_date) {
        return NextResponse.json(
          { error: 'leave_date must match the selected session date' },
          { status: 400 }
        );
      }
    }

    let dupQuery = supabaseAdmin
      .from('leave_requests')
      .select('id, status')
      .eq('student_id', req.user.id)
      .eq('leave_date', leave_date)
      .in('status', ['pending', 'approved']);

    if (session_id) {
      dupQuery = dupQuery.eq('session_id', session_id);
    } else {
      dupQuery = dupQuery.is('session_id', null);
    }

    const { data: existing } = await dupQuery.maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: `A ${existing.status} leave request already exists for this date/session` },
        { status: 409 }
      );
    }

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('leave_requests')
      .insert({
        student_id: req.user.id,
        leave_date,
        session_id: session_id || null,
        reason: reason.trim(),
        status: 'pending',
      })
      .select('id, leave_date, session_id, reason, status, created_at')
      .single();

    if (insertErr) {
      console.error('Leave request insert error:', insertErr.message);
      return NextResponse.json({ error: 'Failed to submit leave request' }, { status: 500 });
    }

    const { data: userRow } = await supabaseAdmin
      .from('users')
      .select('first_name, last_name')
      .eq('id', req.user.id)
      .single();

    const studentName =
      `${userRow?.first_name || ''} ${userRow?.last_name || ''}`.trim() || 'Student';

    let sessionTitle = null;
    if (session_id) {
      const { data: sess } = await supabaseAdmin
        .from('sessions')
        .select('title')
        .eq('id', session_id)
        .single();
      sessionTitle = sess?.title || null;
    }

    await notifyAdminsOfLeaveRequest({
      leaveRequestId: inserted.id,
      studentId: req.user.id,
      studentName,
      leaveDate: leave_date,
      sessionTitle,
      reason: reason.trim(),
    });

    return NextResponse.json({
      message: 'Leave request submitted. Admins have been notified.',
      request: inserted,
    });
  } catch (err) {
    console.error('Leave request POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
