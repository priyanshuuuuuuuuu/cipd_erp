export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { leaveRequests, sessions as sessionsTable, courses, courseEnrollments, users } from '@/drizzle/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { withAuth } from '@/lib/middleware';
import { notifyAdminsOfLeaveRequest } from '@/lib/leave-notifications';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function getHandler(req) {
  try {
    const rows = await db
      .select({
        id: leaveRequests.id,
        leave_date: leaveRequests.leaveDate,
        session_id: leaveRequests.sessionId,
        reason: leaveRequests.reason,
        status: leaveRequests.status,
        admin_notes: leaveRequests.adminNotes,
        created_at: leaveRequests.createdAt,
        reviewed_at: leaveRequests.reviewedAt,
      })
      .from(leaveRequests)
      .where(eq(leaveRequests.studentId, req.user.id))
      .orderBy(desc(leaveRequests.createdAt))
      .limit(100);

    const sessionIds = [...new Set((rows || []).map((r) => r.session_id).filter(Boolean))];
    const sessionMap = {};
    if (sessionIds.length > 0) {
      const sessionRows = await db
        .select({
          id: sessionsTable.id,
          title: sessionsTable.title,
          start_time: sessionsTable.startTime,
          end_time: sessionsTable.endTime,
          courses: {
            name: courses.name,
          },
        })
        .from(sessionsTable)
        .leftJoin(courses, eq(sessionsTable.courseId, courses.id))
        .where(inArray(sessionsTable.id, sessionIds));

      (sessionRows || []).forEach((s) => { sessionMap[s.id] = s; });
    }

    const enriched = (rows || []).map((r) => ({
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

    const enrollments = await db
      .select({ course_id: courseEnrollments.courseId })
      .from(courseEnrollments)
      .where(eq(courseEnrollments.studentId, req.user.id));

    const enrolledCourseIds = new Set(
      (enrollments || []).map((e) => e.course_id)
    );

    const sessions = await db
      .select({
        id: sessionsTable.id,
        title: sessionsTable.title,
        session_date: sessionsTable.sessionDate,
        course_id: sessionsTable.courseId,
        start_time: sessionsTable.startTime,
        courses: {
          name: courses.name,
        },
      })
      .from(sessionsTable)
      .leftJoin(courses, eq(sessionsTable.courseId, courses.id))
      .where(inArray(sessionsTable.id, ids));

    if (!sessions?.length || sessions.length !== ids.length) {
      return NextResponse.json({ error: 'One or more sessions not found' }, { status: 404 });
    }

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

    const existing = await db
      .select({ session_id: leaveRequests.sessionId, status: leaveRequests.status })
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.studentId, req.user.id),
          eq(leaveRequests.leaveDate, leave_date),
          inArray(leaveRequests.sessionId, ids),
          inArray(leaveRequests.status, ['pending', 'approved'])
        )
      );

    if (existing?.length) {
      return NextResponse.json(
        {
          error: `Leave already ${existing[0].status} for one or more selected sessions`,
        },
        { status: 409 }
      );
    }

    const insertRows = ids.map((sessionId) => {
      const sessionInfo = sessionMap.get(sessionId);
      return {
        studentId: req.user.id,
        leaveDate: leave_date,
        sessionId: sessionId,
        reason: reason.trim(),
        status: sessionInfo?.isCapstone ? 'approved' : 'pending',
      };
    });

    const inserted = await db
      .insert(leaveRequests)
      .values(insertRows)
      .returning({
        id: leaveRequests.id,
        leave_date: leaveRequests.leaveDate,
        session_id: leaveRequests.sessionId,
        reason: leaveRequests.reason,
        status: leaveRequests.status,
        created_at: leaveRequests.createdAt,
      });

    const [userRow] = await db
      .select({ first_name: users.firstName, last_name: users.lastName })
      .from(users)
      .where(eq(users.id, req.user.id));

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
