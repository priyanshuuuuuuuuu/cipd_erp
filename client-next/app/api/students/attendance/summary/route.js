export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';

function makeCode(name = '') {
  return name
    .split(/[\s&]+/)
    .filter(Boolean)
    .map(w => w[0].toUpperCase())
    .join('')
    .slice(0, 4);
}

async function handler(req) {
  try {
    const studentId = req.user.id;

    // 1. Get all courses the student is enrolled in
    const { data: enrollments, error: enrollErr } = await supabaseAdmin
      .from('course_enrollments')
      .select('course_id, courses ( id, name )')
      .eq('student_id', studentId);

    if (enrollErr) console.error('Enrollment fetch error:', enrollErr.message);

    const enrolledCourses = (enrollments || []).map(e => ({
      id: e.courses?.id || e.course_id,
      name: e.courses?.name || 'Unknown',
    }));

    // 2. Get all attendance records for this student
    const { data: records, error: recErr } = await supabaseAdmin
      .from('attendance_records')
      .select(`
        status,
        sessions (
          course_id,
          session_date
        )
      `)
      .eq('student_id', studentId)
      .order('calculated_at', { ascending: false });

    if (recErr) console.error('Attendance records fetch error:', recErr.message);

    const allRecords = records || [];

    // 3. Build per-course counts from attendance records
    const countsByCourse = {};
    for (const r of allRecords) {
      const courseId = r.sessions?.course_id;
      if (!courseId) continue;
      if (!countsByCourse[courseId]) countsByCourse[courseId] = { attended: 0, total: 0 };
      const s = r.status;
      if (s === 'leave' || s === 'other') continue;
      countsByCourse[courseId].total++;
      if (s === 'present' || s === 'present_online' || s === 'half') {
        countsByCourse[courseId].attended++;
      }
    }

    // 4. Build courses array with percentage
    const courses = enrolledCourses.map(c => {
      const counts = countsByCourse[c.id] || { attended: 0, total: 0 };
      const pct = counts.total > 0 ? Math.round((counts.attended / counts.total) * 1000) / 10 : 0;
      return {
        course_code: makeCode(c.name),
        course_name: c.name,
        faculty: '',
        attended: counts.attended,
        total: counts.total,
        pct,
      };
    }).sort((a, b) => a.course_name.localeCompare(b.course_name));

    // 5. Overall stats
    let overallNum = 0, overallDen = 0;
    for (const r of allRecords) {
      const s = r.status;
      if (s === 'leave' || s === 'other') continue;
      overallDen++;
      if (s === 'present' || s === 'present_online') overallNum += 1;
      else if (s === 'half') overallNum += 0.5;
    }
    const overallPct = overallDen > 0
      ? Math.round((overallNum / overallDen) * 1000) / 10
      : 0;
    const totalAttended = allRecords.filter(r =>
      ['present', 'present_online', 'half'].includes(r.status)
    ).length;
    const totalMissed = allRecords.filter(r => r.status === 'absent').length;

    // 6. Streak
    const byDate = {};
    for (const r of allRecords) {
      const date = r.sessions?.session_date;
      if (!date) continue;
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(r.status);
    }
    const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));
    let streak = 0;
    for (const date of sortedDates) {
      const statuses = byDate[date];
      const allPresent = statuses.every(s =>
        s === 'present' || s === 'present_online' || s === 'half'
      );
      if (allPresent) streak++;
      else break;
    }

    // 7. Calendar data
    const calByDate = {};
    for (const r of allRecords) {
      const date = r.sessions?.session_date;
      if (!date) continue;
      const s = r.status;
      if (s === 'leave' || s === 'other') continue;
      if (!calByDate[date]) calByDate[date] = { present: 0, absent: 0 };
      if (['present', 'present_online', 'half'].includes(s)) calByDate[date].present++;
      else if (s === 'absent') calByDate[date].absent++;
    }
    const calendarData = {};
    for (const [date, { present, absent }] of Object.entries(calByDate)) {
      if (present > 0 && absent === 0) calendarData[date] = 'full';
      else if (present > 0)            calendarData[date] = 'partial';
      else                             calendarData[date] = 'absent';
    }

    return NextResponse.json({
      overall: {
        total:    overallDen,
        attended: totalAttended,
        missed:   totalMissed,
        pct:      overallPct,
      },
      streak,
      courses,
      calendarData,
    });

  } catch (err) {
    console.error('Attendance summary error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
