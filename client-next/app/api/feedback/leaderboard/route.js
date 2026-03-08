import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';

async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get('course_id');

    // Get all feedback responses with student info
    let query = supabaseAdmin
      .from('feedback_responses')
      .select(`
        student_id, rating, submitted_at,
        sessions ( id, course_id )
      `)
      .not('rating', 'is', null);

    if (courseId) {
      // We'll filter by course post-query since it's nested
    }

    const { data: responses } = await query;

    // Group by student and compute stats
    const studentMap = {};
    (responses || []).forEach(r => {
      if (courseId && r.sessions?.course_id !== courseId) return;

      const sid = r.student_id;
      if (!studentMap[sid]) {
        studentMap[sid] = { student_id: sid, totalCredits: 0, submissions: 0, sessionIds: new Set() };
      }
      // +20 credits per session feedback, count unique sessions
      studentMap[sid].sessionIds.add(r.sessions?.id);
    });

    // Compute credits and streaks
    const studentIds = Object.keys(studentMap);
    let studentInfos = [];
    if (studentIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from('users')
        .select('id, first_name, last_name')
        .in('id', studentIds);

      const { data: students } = await supabaseAdmin
        .from('students')
        .select('id, enrollment_no')
        .in('id', studentIds);

      studentInfos = studentIds.map(sid => {
        const user = (users || []).find(u => u.id === sid);
        const student = (students || []).find(s => s.id === sid);
        const stats = studentMap[sid];
        const submissions = stats.sessionIds.size;
        return {
          student_id: sid,
          name: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Unknown',
          enrollment_no: student?.enrollment_no || '',
          credits: submissions * 20,
          submissions,
        };
      });
    }

    // Sort by credits desc
    studentInfos.sort((a, b) => b.credits - a.credits);

    // Add ranks
    const leaderboard = studentInfos.map((s, i) => ({
      rank: i + 1,
      ...s,
      percentile: `Top ${Math.max(1, Math.round(((i + 1) / studentInfos.length) * 100))}%`,
    }));

    return NextResponse.json({ leaderboard });
  } catch (err) {
    console.error('Leaderboard error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
