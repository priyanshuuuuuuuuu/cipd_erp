export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

async function getHandler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const date = searchParams.get('date');

    let query = supabaseAdmin
      .from('leave_requests')
      .select('id, leave_date, session_id, student_id, reason, status, admin_notes, created_at, reviewed_at, reviewed_by')
      .order('created_at', { ascending: false })
      .limit(200);

    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query = query.eq('status', status);
    }
    if (date) {
      query = query.eq('leave_date', date);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Admin leave requests fetch error:', error.message);
      return NextResponse.json({ error: 'Failed to fetch leave requests' }, { status: 500 });
    }

    const rows = data || [];

    // ── 1. Resolve students ──────────────────────────────────────────────────
    const studentIds = [...new Set(rows.map((r) => r.student_id).filter(Boolean))];
    const studentMap = {};
    if (studentIds.length > 0) {
      const { data: students } = await supabaseAdmin
        .from('students')
        .select('id, enrollment_no')
        .in('id', studentIds);
      const userIds = (students || []).map((s) => s.id);
      const userMap = {};
      if (userIds.length > 0) {
        const { data: users } = await supabaseAdmin
          .from('users')
          .select('id, first_name, last_name, email')
          .in('id', userIds);
        (users || []).forEach((u) => { userMap[u.id] = u; });
      }
      (students || []).forEach((s) => {
        studentMap[s.id] = { ...s, users: userMap[s.id] || null };
      });
    }

    // ── 2. Resolve sessions ──────────────────────────────────────────────────
    const sessionIds = [...new Set(rows.map((r) => r.session_id).filter(Boolean))];
    const sessionMap = {};
    if (sessionIds.length > 0) {
      const { data: sessions } = await supabaseAdmin
        .from('sessions')
        .select('id, title, start_time, end_time, course_id')
        .in('id', sessionIds);
      const courseIds = [...new Set((sessions || []).map((s) => s.course_id).filter(Boolean))];
      const courseMap = {};
      if (courseIds.length > 0) {
        const { data: courses } = await supabaseAdmin
          .from('courses')
          .select('id, name')
          .in('id', courseIds);
        (courses || []).forEach((c) => { courseMap[c.id] = c; });
      }
      (sessions || []).forEach((s) => {
        sessionMap[s.id] = { ...s, courses: s.course_id ? (courseMap[s.course_id] || null) : null };
      });
    }

    // ── 3. Resolve reviewers ─────────────────────────────────────────────────
    const reviewerIds = [...new Set(rows.map((r) => r.reviewed_by).filter(Boolean))];
    const reviewerMap = {};
    if (reviewerIds.length > 0) {
      const { data: reviewers } = await supabaseAdmin
        .from('users')
        .select('id, first_name, last_name')
        .in('id', reviewerIds);
      (reviewers || []).forEach((u) => { reviewerMap[u.id] = u; });
    }

    const enriched = rows.map((r) => ({
      ...r,
      students: r.student_id ? (studentMap[r.student_id] || null) : null,
      sessions: r.session_id ? (sessionMap[r.session_id] || null) : null,
      reviewer: r.reviewed_by ? (reviewerMap[r.reviewed_by] || null) : null,
    }));

    const pending = enriched.filter((r) => r.status === 'pending').length;
    const approved = enriched.filter((r) => r.status === 'approved').length;

    return NextResponse.json({
      requests: enriched,
      stats: { pending, approved, total: enriched.length },
    });
  } catch (err) {
    console.error('Admin leave requests GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(getHandler, ['admin']);
