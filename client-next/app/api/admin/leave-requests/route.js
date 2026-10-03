export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { leaveRequests, students, users, sessions, courses } from '@/drizzle/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';

async function getHandler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const date = searchParams.get('date');

    const conditions = [];
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      conditions.push(eq(leaveRequests.status, status));
    }
    if (date) {
      conditions.push(eq(leaveRequests.leaveDate, date));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: leaveRequests.id,
        leave_date: leaveRequests.leaveDate,
        session_id: leaveRequests.sessionId,
        student_id: leaveRequests.studentId,
        reason: leaveRequests.reason,
        status: leaveRequests.status,
        admin_notes: leaveRequests.adminNotes,
        created_at: leaveRequests.createdAt,
        reviewed_at: leaveRequests.reviewedAt,
        reviewed_by: leaveRequests.reviewedBy,
      })
      .from(leaveRequests)
      .where(whereClause)
      .orderBy(desc(leaveRequests.createdAt))
      .limit(200);

    if (!rows || rows.length === 0) {
      return NextResponse.json({
        requests: [],
        stats: { pending: 0, approved: 0, total: 0 },
      });
    }

    // ── 1. Resolve students ──────────────────────────────────────────────────
    const studentIds = [...new Set(rows.map((r) => r.student_id).filter(Boolean))];
    const studentMap = {};
    if (studentIds.length > 0) {
      const studentRows = await db
        .select({
          id: students.id,
          enrollment_no: students.enrollmentNo,
          first_name: users.firstName,
          last_name: users.lastName,
          email: users.email,
        })
        .from(students)
        .leftJoin(users, eq(students.id, users.id))
        .where(inArray(students.id, studentIds));

      studentRows.forEach((s) => {
        studentMap[s.id] = {
          id: s.id,
          enrollment_no: s.enrollment_no,
          users: s.first_name || s.email ? {
            id: s.id,
            first_name: s.first_name,
            last_name: s.last_name,
            email: s.email,
          } : null,
        };
      });
    }

    // ── 2. Resolve sessions ──────────────────────────────────────────────────
    const sessionIds = [...new Set(rows.map((r) => r.session_id).filter(Boolean))];
    const sessionMap = {};
    if (sessionIds.length > 0) {
      const sessionRows = await db
        .select({
          id: sessions.id,
          title: sessions.title,
          start_time: sessions.startTime,
          end_time: sessions.endTime,
          course_id: sessions.courseId,
          course_name: courses.name,
        })
        .from(sessions)
        .leftJoin(courses, eq(sessions.courseId, courses.id))
        .where(inArray(sessions.id, sessionIds));

      sessionRows.forEach((s) => {
        sessionMap[s.id] = {
          id: s.id,
          title: s.title,
          start_time: s.start_time,
          end_time: s.end_time,
          course_id: s.course_id,
          courses: s.course_id ? { id: s.course_id, name: s.course_name } : null,
        };
      });
    }

    // ── 3. Resolve reviewers ─────────────────────────────────────────────────
    const reviewerIds = [...new Set(rows.map((r) => r.reviewed_by).filter(Boolean))];
    const reviewerMap = {};
    if (reviewerIds.length > 0) {
      const reviewerRows = await db
        .select({
          id: users.id,
          first_name: users.firstName,
          last_name: users.lastName,
        })
        .from(users)
        .where(inArray(users.id, reviewerIds));

      reviewerRows.forEach((u) => {
        reviewerMap[u.id] = u;
      });
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
