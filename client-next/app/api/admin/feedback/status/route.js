export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

async function handler(req) {
  try {
    // ── 1. Fire all bulk queries in parallel (4 total, regardless of # courses) ──
    const [
      { data: courses },
      { data: enrollmentRows },
      { data: allSessions },
      { data: allFeedback },
    ] = await Promise.all([
      // All courses
      supabaseAdmin.from('courses').select('id, name'),

      // All enrollment rows — we only need course_id to count per course
      supabaseAdmin.from('course_enrollments').select('course_id'),

      // All completed sessions — course_id + session id
      supabaseAdmin
        .from('sessions')
        .select('id, course_id')
        .eq('status', 'completed'),

      // All feedback responses — session_id + student_id for deduplication
      supabaseAdmin
        .from('feedback_responses')
        .select('session_id, student_id'),
    ]);

    if (!courses || courses.length === 0) {
      return NextResponse.json({ feedback_status: [] });
    }

    // ── 2. Build in-memory lookup maps ────────────────────────────────────────

    // enrolledCount[course_id] → number of enrolled students
    const enrolledCount = {};
    for (const row of (enrollmentRows || [])) {
      enrolledCount[row.course_id] = (enrolledCount[row.course_id] || 0) + 1;
    }

    // sessionsByCourse[course_id] → Set of session ids
    const sessionsByCourse = {};
    for (const s of (allSessions || [])) {
      if (!sessionsByCourse[s.course_id]) sessionsByCourse[s.course_id] = new Set();
      sessionsByCourse[s.course_id].add(s.id);
    }

    // ── 3. Aggregate per course (pure in-memory, no more DB calls) ────────────
    const statusList = [];

    for (const course of courses) {
      const sessionSet = sessionsByCourse[course.id];
      const totalEnrolled = enrolledCount[course.id] || 0;

      if (!sessionSet || sessionSet.size === 0 || totalEnrolled === 0) continue;

      // Count unique (session_id, student_id) pairs submitted for this course's sessions
      const submittedPairs = new Set(
        (allFeedback || [])
          .filter(f => sessionSet.has(f.session_id))
          .map(f => `${f.session_id}::${f.student_id}`)
      );

      const expectedTotal = totalEnrolled * sessionSet.size;
      const submitted = submittedPairs.size;
      const pending = Math.max(0, expectedTotal - submitted);

      statusList.push({
        course: course.name,
        course_id: course.id,
        total_enrolled: totalEnrolled,
        completed_sessions: sessionSet.size,
        total: expectedTotal,
        submitted,
        pending,
      });
    }

    return NextResponse.json({ feedback_status: statusList });
  } catch (err) {
    console.error('Admin feedback status error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(handler, ['admin']);
