export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { attendanceRecords, students, users, feedbackResponses } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { withAuth } from '@/lib/middleware';

/**
 * Global Engagement Leaderboard
 *
 * Built from attendance_records (Wi-Fi) + feedback_responses.
 * Max per session: 5 attendance + 3 feedback = 8
 */

async function handler(req) {
  try {
    const allRecords = await db
      .select({
        student_id: attendanceRecords.studentId,
        session_id: attendanceRecords.sessionId,
        points: attendanceRecords.points,
        status: attendanceRecords.status,
      })
      .from(attendanceRecords);

    const allStudents = await db
      .select({
        id: students.id,
        enrollment_no: students.enrollmentNo,
        first_name: users.firstName,
        last_name: users.lastName,
      })
      .from(students)
      .innerJoin(users, eq(students.id, users.id))
      .where(eq(users.isActive, true));

    const studentMap = {};
    (allStudents || []).forEach((s) => {
      studentMap[s.id] = {
        name:
          `${s.first_name || ''} ${s.last_name || ''}`.trim() ||
          'Unknown',
        enrollment_no: s.enrollment_no || '',
      };
    });

    const fbResponses = await db
      .select({
        student_id: feedbackResponses.studentId,
        session_id: feedbackResponses.sessionId,
      })
      .from(feedbackResponses);

    const feedbackSet = new Set();
    (fbResponses || []).forEach((r) => {
      if (r.student_id && r.session_id) {
        feedbackSet.add(`${r.student_id}:${r.session_id}`);
      }
    });

    const distinctSessions = new Set(allRecords.map((r) => r.session_id));
    const totalSessions = distinctSessions.size;

    const pointsMap = {};

    for (const rec of allRecords) {
      const { student_id: studentId, session_id: sessionId, points, status } =
        rec;
      if (!studentId || !sessionId) continue;
      const student = studentMap[studentId];
      if (!student) continue;

      if (!pointsMap[studentId]) {
        pointsMap[studentId] = {
          name: student.name,
          enrollment_no: student.enrollment_no,
          attendancePoints: 0,
          bonusPoints: 0,
          feedbackPoints: 0,
          totalPoints: 0,
          sessionsEnrolled: 0,
          sessionsAttended: 0,
        };
      }

      pointsMap[studentId].sessionsEnrolled++;
      const attendancePoints = Number(points) || 0;
      pointsMap[studentId].attendancePoints += attendancePoints;

      if (
        status === 'present' ||
        status === 'partial' ||
        (attendancePoints > 0 && status !== 'absent')
      ) {
        pointsMap[studentId].sessionsAttended++;
      }

      const feedbackPoints = feedbackSet.has(`${studentId}:${sessionId}`) ? 3 : 0;
      pointsMap[studentId].feedbackPoints += feedbackPoints;
      pointsMap[studentId].totalPoints += attendancePoints + feedbackPoints;
    }

    const leaderboard = Object.entries(pointsMap)
      .map(([studentId, data]) => ({
        student_id: studentId,
        ...data,
        maxPossible: data.sessionsEnrolled * 8,
      }))
      .filter((s) => s.sessionsEnrolled > 0)
      .sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        return b.sessionsAttended - a.sessionsAttended;
      })
      .map((s, i) => ({
        rank: i + 1,
        ...s,
      }));

    return NextResponse.json({
      leaderboard,
      meta: {
        totalSessions,
        maxPerSession: 8,
        breakdown: '5 attendance (late entry + ping %) + 3 feedback',
        source: 'attendance_records',
      },
    });
  } catch (err) {
    console.error('Leaderboard error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);

