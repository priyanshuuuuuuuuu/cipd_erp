export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';

/**
 * Global Engagement Leaderboard
 *
 * Built from attendance_records (Wi-Fi) + feedback_responses.
 * Max per session: 5 attendance + 3 feedback = 8
 */

async function handler(req) {
  try {
    const PAGE_SIZE = 1000;
    let allRecords = [];
    let from = 0;

    while (true) {
      const { data: page, error: recError } = await supabaseAdmin
        .from('attendance_records')
        .select('student_id, session_id, points, status')
        .range(from, from + PAGE_SIZE - 1);

      if (recError) throw new Error('attendance_records: ' + recError.message);
      if (!page || page.length === 0) break;
      allRecords = allRecords.concat(page);
      if (page.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    const { data: allStudents, error: studentsError } = await supabaseAdmin
      .from('students')
      .select('id, enrollment_no, users ( first_name, last_name )');

    if (studentsError) throw new Error('students: ' + studentsError.message);

    const studentMap = {};
    (allStudents || []).forEach((s) => {
      studentMap[s.id] = {
        name:
          `${s.users?.first_name || ''} ${s.users?.last_name || ''}`.trim() ||
          'Unknown',
        enrollment_no: s.enrollment_no || '',
      };
    });

    const { data: feedbackResponses, error: fbError } = await supabaseAdmin
      .from('feedback_responses')
      .select('student_id, session_id');

    if (fbError) throw new Error('feedback_responses: ' + fbError.message);

    const feedbackSet = new Set();
    (feedbackResponses || []).forEach((r) => {
      feedbackSet.add(`${r.student_id}:${r.session_id}`);
    });

    const distinctSessions = new Set(allRecords.map((r) => r.session_id));
    const totalSessions = distinctSessions.size;

    const pointsMap = {};

    for (const rec of allRecords) {
      const { student_id: studentId, session_id: sessionId, points, status } =
        rec;
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
