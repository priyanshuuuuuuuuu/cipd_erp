export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessions, attendanceRecords } from '@/drizzle/schema';
import { eq, gte, lte, and, not } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';

/**
 * POST /api/admin/attendance/override
 * Body: { session_id, student_id, action: 'present' | 'absent' | 'leave', points?: number }
 *
 * present → points (default 5, admin-configurable), status=present, admin_override=true
 * leave   → 0 points, status=leave, admin_override=true
 * absent  → penalty cascade (faking attendance)
 */
async function handler(req) {
  try {
    const body = await req.json();
    const { session_id, student_id, action, points: customPoints } = body;

    if (
      !session_id ||
      !student_id ||
      !['present', 'absent', 'leave'].includes(action)
    ) {
      return NextResponse.json(
        {
          error:
            'session_id, student_id, and action (present/absent/leave) required',
        },
        { status: 400 }
      );
    }

    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, session_id),
      columns: { id: true, sessionDate: true },
      with: {
        course: { columns: { id: true, name: true } },
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (action === 'present') {
      let assignedPoints = 5;
      if (customPoints !== undefined && customPoints !== null) {
        const parsed = parseFloat(customPoints);
        if (isNaN(parsed) || parsed < -2 || parsed > 5) {
          return NextResponse.json(
            { error: 'points must be a number between -2 and 5' },
            { status: 400 }
          );
        }
        assignedPoints = parsed;
      }

      await db
        .insert(attendanceRecords)
        .values({
          sessionId: session_id,
          studentId: student_id,
          status: 'present',
          points: String(assignedPoints), // numeric column usually expects string in drizzle
          adminOverride: true,
          penalty: false,
          penaltyReason: null,
          calculatedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: [attendanceRecords.sessionId, attendanceRecords.studentId],
          set: {
            status: 'present',
            points: String(assignedPoints),
            adminOverride: true,
            penalty: false,
            penaltyReason: null,
            calculatedAt: new Date().toISOString(),
          },
        });

      return NextResponse.json({
        message: 'Student marked present by admin',
        points: assignedPoints,
        action: 'present',
      });
    }

    if (action === 'leave') {
      await db
        .insert(attendanceRecords)
        .values({
          sessionId: session_id,
          studentId: student_id,
          status: 'leave',
          points: '0',
          adminOverride: true,
          penalty: false,
          penaltyReason: null,
          calculatedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: [attendanceRecords.sessionId, attendanceRecords.studentId],
          set: {
            status: 'leave',
            points: '0',
            adminOverride: true,
            penalty: false,
            penaltyReason: null,
            calculatedAt: new Date().toISOString(),
          },
        });

      return NextResponse.json({
        message: 'Student marked on approved leave by admin',
        points: 0,
        action: 'leave',
      });
    }

    if (action === 'absent') {
      await db
        .insert(attendanceRecords)
        .values({
          sessionId: session_id,
          studentId: student_id,
          status: 'absent',
          points: '-2',
          adminOverride: true,
          penalty: true,
          penaltyReason: 'Faking attendance — marked absent by admin',
          calculatedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: [attendanceRecords.sessionId, attendanceRecords.studentId],
          set: {
            status: 'absent',
            points: '-2',
            adminOverride: true,
            penalty: true,
            penaltyReason: 'Faking attendance — marked absent by admin',
            calculatedAt: new Date().toISOString(),
          },
        });

      const sessionDate = new Date(session.sessionDate + 'T00:00:00+05:30');
      const oneWeekBefore = new Date(sessionDate);
      oneWeekBefore.setDate(oneWeekBefore.getDate() - 7);
      const oneWeekAfter = new Date(sessionDate);
      oneWeekAfter.setDate(oneWeekAfter.getDate() + 7);

      const weekBeforeStr = oneWeekBefore.toISOString().split('T')[0];
      const weekAfterStr = oneWeekAfter.toISOString().split('T')[0];

      const penaltySessions = await db
        .select({ id: sessions.id, sessionDate: sessions.sessionDate, title: sessions.title })
        .from(sessions)
        .where(
          and(
            eq(sessions.courseId, session.course?.id),
            gte(sessions.sessionDate, weekBeforeStr),
            lte(sessions.sessionDate, weekAfterStr)
          )
        );

      const penaltyRecords = penaltySessions
        .filter((s) => s.id !== session_id)
        .map((s) => ({
          sessionId: s.id,
          studentId: student_id,
          status: 'absent',
          points: '0',
          adminOverride: false,
          penalty: true,
          penaltyReason: `Penalty: faking attendance on ${session.sessionDate} (${session.course?.name || 'course'})`,
          calculatedAt: new Date().toISOString(),
        }));

      let penaltyCount = 0;
      if (penaltyRecords.length > 0) {
        for (const record of penaltyRecords) {
           await db
            .insert(attendanceRecords)
            .values(record)
            .onConflictDoUpdate({
              target: [attendanceRecords.sessionId, attendanceRecords.studentId],
              set: {
                status: record.status,
                points: record.points,
                adminOverride: record.adminOverride,
                penalty: record.penalty,
                penaltyReason: record.penaltyReason,
                calculatedAt: record.calculatedAt,
              },
            });
        }
        penaltyCount = penaltyRecords.length;
      }

      return NextResponse.json({
        message: 'Student marked absent with faking penalty',
        points: -2,
        action: 'absent',
        penaltySessions: penaltyCount,
        penaltyRange: `${weekBeforeStr} to ${weekAfterStr}`,
      });
    }
  } catch (err) {
    console.error('Override error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withRole(handler, ['admin']);
