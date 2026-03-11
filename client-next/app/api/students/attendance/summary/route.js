export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';

async function handler(req) {
  try {
    // Overall attendance from the view
    const { data: summary } = await supabaseAdmin
      .from('student_attendance_summary')
      .select('attendance_percentage')
      .eq('student_id', req.user.id)
      .single();

    // All attendance records for this student
    const { data: records } = await supabaseAdmin
      .from('attendance_records')
      .select(`
        id, session_id, ping_count, status, calculated_at,
        sessions (
          id, title, session_date, start_time, end_time,
          course_id,
          courses ( id, name )
        )
      `)
      .eq('student_id', req.user.id)
      .order('calculated_at', { ascending: false });

    // Per-course breakdown
    const courseMap = {};
    (records || []).forEach(r => {
      const courseId = r.sessions?.course_id;
      const courseName = r.sessions?.courses?.name || 'Unknown';
      if (!courseMap[courseId]) {
        courseMap[courseId] = { course_id: courseId, course_name: courseName, total: 0, attended: 0, missed: 0 };
      }
      courseMap[courseId].total++;
      if (r.status === 'present') courseMap[courseId].attended++;
      else courseMap[courseId].missed++;
    });

    const courses = Object.values(courseMap).map(c => ({
      ...c,
      pct: c.total > 0 ? Math.round((c.attended / c.total) * 1000) / 10 : 0,
    }));

    // Calculate streak (consecutive present)
    const sortedRecords = (records || [])
      .sort((a, b) => new Date(b.sessions?.session_date) - new Date(a.sessions?.session_date));
    let streak = 0;
    for (const r of sortedRecords) {
      if (r.status === 'present') streak++;
      else break;
    }

    const totalAttended = (records || []).filter(r => r.status === 'present').length;
    const totalMissed = (records || []).filter(r => r.status !== 'present').length;

    return NextResponse.json({
      overall: {
        total: (records || []).length,
        attended: totalAttended,
        missed: totalMissed,
        pct: summary?.attendance_percentage || 0,
      },
      streak,
      courses,
    });
  } catch (err) {
    console.error('Attendance summary error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
