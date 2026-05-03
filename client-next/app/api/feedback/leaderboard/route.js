export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';

/**
 * Global Engagement Leaderboard
 *
 * Built from student_attendance_marks (the authoritative attendance table).
 *
 * Points per session:
 *   Attendance : P/PO/C = 5 pts, H = 3 pts, A/L = 0 pts
 *   Bonus      : 1 pt  (P/PO/C mark — full presence)
 *   Feedback   : 3 pts (submitted feedback for that session)
 *   Max/session: 9
 *
 * This implementation uses 4 bulk queries (no per-session loops).
 */

async function handler(req) {
  try {
    // ── 1. Fetch ALL attendance marks (paginated to bypass Supabase 1000-row cap) ──
    // With 18 students × ~237 sessions ≈ 4,000+ rows, a single query would be truncated.
    const PAGE_SIZE = 1000;
    let allMarks = [];
    let from = 0;
    while (true) {
      const { data: page, error: marksError } = await supabaseAdmin
        .from('student_attendance_marks')
        .select('student_id, session_id, session_date, session_slot, status, course_id')
        .not('session_id', 'is', null)
        .range(from, from + PAGE_SIZE - 1);

      if (marksError) throw new Error('student_attendance_marks: ' + marksError.message);
      if (!page || page.length === 0) break;
      allMarks = allMarks.concat(page);
      if (page.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    const marks = allMarks;

    if (marks.length === 0) {
      return NextResponse.json({ leaderboard: [], meta: { totalSessions: 0 } });
    }

    // ── 2. Fetch all students ────────────────────────────────────────────────
    const { data: allStudents, error: studentsError } = await supabaseAdmin
      .from('students')
      .select('id, enrollment_no, users ( first_name, last_name )');

    if (studentsError) throw new Error('students: ' + studentsError.message);

    const studentMap = {};
    (allStudents || []).forEach(s => {
      studentMap[s.id] = {
        name: `${s.users?.first_name || ''} ${s.users?.last_name || ''}`.trim() || 'Unknown',
        enrollment_no: s.enrollment_no || '',
      };
    });

    // ── 3. Fetch all feedback responses ─────────────────────────────────────
    const { data: feedbackResponses, error: fbError } = await supabaseAdmin
      .from('feedback_responses')
      .select('student_id, session_id')
      .not('rating', 'is', null);

    if (fbError) throw new Error('feedback_responses: ' + fbError.message);

    // Build set of "studentId:sessionId" for O(1) lookup
    const feedbackSet = new Set();
    (feedbackResponses || []).forEach(r => {
      feedbackSet.add(`${r.student_id}:${r.session_id}`);
    });

    // ── 4. Count total distinct completed sessions for meta ──────────────────
    const distinctSessions = new Set(marks.map(m => m.session_id));
    const totalSessions = distinctSessions.size;

    // ── 5. Aggregate points per student ─────────────────────────────────────
    //
    // Status → attendance points mapping:
    //   P / PO / C  →  5 pts  (full presence, earns bonus too)
    //   H           →  3 pts  (partial presence, no bonus)
    //   A / L / other → 0 pts
    //
    const pointsMap = {};

    for (const mark of marks) {
      const { student_id: studentId, session_id: sessionId, status } = mark;
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

      // Attendance points
      let attendancePoints = 0;
      let bonusPoints = 0;

      if (status === 'P' || status === 'PO' || status === 'C') {
        attendancePoints = 5;
        bonusPoints = 1;  // full presence bonus
        pointsMap[studentId].sessionsAttended++;
      } else if (status === 'H') {
        attendancePoints = 3;
        pointsMap[studentId].sessionsAttended++;
      }
      // A, L → 0 points, not counted as attended

      // Feedback points
      const feedbackPoints = feedbackSet.has(`${studentId}:${sessionId}`) ? 3 : 0;

      pointsMap[studentId].attendancePoints += attendancePoints;
      pointsMap[studentId].bonusPoints += bonusPoints;
      pointsMap[studentId].feedbackPoints += feedbackPoints;
      pointsMap[studentId].totalPoints += attendancePoints + bonusPoints + feedbackPoints;
    }

    // ── 6. Build and sort leaderboard ────────────────────────────────────────
    const leaderboard = Object.entries(pointsMap)
      .map(([studentId, data]) => ({
        student_id: studentId,
        ...data,
        maxPossible: data.sessionsEnrolled * 9,
      }))
      .filter(s => s.sessionsEnrolled > 0)
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
        maxPerSession: 9,
        breakdown: '5 attendance + 1 bonus + 3 feedback',
        source: 'student_attendance_marks',
      },
    });
  } catch (err) {
    console.error('Leaderboard error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
