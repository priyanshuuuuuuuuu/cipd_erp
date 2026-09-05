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
      .select('id, leave_date, session_id, reason, status, admin_notes, created_at, reviewed_at')
      .eq('student_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Leave requests fetch error:', error.message);
      return NextResponse.json({ error: 'Failed to fetch leave requests' }, { status: 500 });
    }

    const rows = data || [];

    // Manually resolve session details to avoid schema-cache FK issues
    const sessionIds = [...new Set(rows.map((r) => r.session_id).filter(Boolean))];
    const sessionMap = {};
    if (sessionIds.length > 0) {
      const { data: sessions } = await supabaseAdmin
        .from('sessions')
        .select('id, title, start_time, end_time, courses ( name )')
        .in('id', sessionIds);
      (sessions || []).forEach((s) => { sessionMap[s.id] = s; });
    }

    const enriched = rows.map((r) => ({
      ...r,
      sessions: r.session_id ? (sessionMap[r.session_id] || null) : null,
    }));

    return NextResponse.json({ requests: enriched });
  } catch (err) {
    console.error('Leave requests GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function postHandler(req) {
  try {
    const body = await req.json();
    const { leave_date, session_ids, reason } = body;

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

    const ids = Array.isArray(session_ids)
      ? [...new Set(session_ids.filter(Boolean))]
      : [];

    if (ids.length === 0) {
      return NextResponse.json(
        { error: 'Select at least one session for leave' },
        { status: 400 }
      );
    }

    const { data: enrollments } = await supabaseAdmin
      .from('course_enrollments')
      .select('course_id')
      .eq('student_id', req.user.id);

    const enrolledCourseIds = new Set(
      (enrollments || []).map((e) => e.course_id)
    );

    const { data: sessions } = await supabaseAdmin
      .from('sessions')
      .select('id, title, session_date, course_id, start_time, courses ( name )')
      .in('id', ids);

    if (!sessions?.length || sessions.length !== ids.length) {
      return NextResponse.json({ error: 'One or more sessions not found' }, { status: 404 });
    }

    // Create a map to quickly check if a session is capstone
    const sessionMap = new Map();

    for (const s of sessions) {
      if (s.session_date !== leave_date) {
        return NextResponse.json(
          { error: 'All selected sessions must be on the chosen leave date' },
          { status: 400 }
        );
      }
      if (!enrolledCourseIds.has(s.course_id)) {
        return NextResponse.json(
          { error: 'You are not enrolled in one of the selected sessions' },
          { status: 403 }
        );
      }
      
      const courseName = s.courses?.name || '';
      const isCapstone = courseName.toLowerCase().includes('capstone');
      sessionMap.set(s.id, { isCapstone });
    }

    const { data: existing } = await supabaseAdmin
      .from('leave_requests')
      .select('session_id, status')
      .eq('student_id', req.user.id)
      .eq('leave_date', leave_date)
      .in('session_id', ids)
      .in('status', ['pending', 'approved']);

    if (existing?.length) {
      return NextResponse.json(
        {
          error: `Leave already ${existing[0].status} for one or more selected sessions`,
        },
        { status: 409 }
      );
    }

    const rows = ids.map((sessionId) => {
      const sessionInfo = sessionMap.get(sessionId);
      return {
        student_id: req.user.id,
        leave_date,
        session_id: sessionId,
        reason: reason.trim(),
        status: sessionInfo?.isCapstone ? 'approved' : 'pending',
      };
    });

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('leave_requests')
      .insert(rows)
      .select('id, leave_date, session_id, reason, status, created_at');

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

    const sessionTitles = sessions.map((s) => s.title).join(', ');

    await notifyAdminsOfLeaveRequest({
      leaveRequestId: inserted[0]?.id,
      studentId: req.user.id,
      studentName,
      leaveDate: leave_date,
      sessionTitle: sessionTitles,
      reason: reason.trim(),
    });

    return NextResponse.json({
      message: `Leave request submitted for ${ids.length} session(s). Admins have been notified.`,
      requests: inserted,
    });
  } catch (err) {
    console.error('Leave request POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
