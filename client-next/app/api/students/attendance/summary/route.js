export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';

/** Generate a short 2-4 char code from a course name. e.g. "Product Development" → "PD" */
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

    // ── 1. Pre-computed course-wise percentages ───────────────────────────
    // student_course_attendance already has all business logic applied
    // (half=0.5, C-limit, leave excluded). Use it as the source of truth for pct.
    const { data: courseAttendance, error: e1 } = await supabaseAdmin
      .from('student_course_attendance')
      .select('attendance_percentage, courses(id, name)')
      .eq('student_id', studentId);

    if (e1) {
      console.error('student_course_attendance fetch error:', e1.message);
    }

    // ── 2. Raw attendance records for counts + streak ─────────────────────
    const { data: records, error: e2 } = await supabaseAdmin
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

    if (e2) {
      console.error('attendance_records fetch error:', e2.message);
    }

    const allRecords = records || [];

    // ── 3. Per-course session counts (attended / total) ───────────────────
    // attended = present + present_online + half (visually "present" sessions)
    // total    = present + present_online + half + absent  (denominator, excludes leave/other)
    const countsByCourse = {};
    for (const r of allRecords) {
      const courseId = r.sessions?.course_id;
      if (!courseId) continue;
      if (!countsByCourse[courseId]) countsByCourse[courseId] = { attended: 0, total: 0 };
      const s = r.status;
      if (s === 'leave' || s === 'other') continue; // excluded from denominator
      countsByCourse[courseId].total++;
      if (s === 'present' || s === 'present_online' || s === 'half') {
        countsByCourse[courseId].attended++;
      }
    }

    // ── 4. Build courses array using pre-computed pct ─────────────────────
    const courses = (courseAttendance || []).map(row => {
      const courseId  = row.courses?.id;
      const courseName = row.courses?.name || 'Unknown';
      const counts    = countsByCourse[courseId] || { attended: 0, total: 0 };
      return {
        course_code: makeCode(courseName),
        course_name: courseName,
        faculty:     '',  // not stored in current schema
        attended:    counts.attended,
        total:       counts.total,
        pct:         parseFloat((row.attendance_percentage || 0).toFixed(1)),
      };
    }).sort((a, b) => a.course_name.localeCompare(b.course_name));

    // ── 5. Overall stats (computed directly from raw records) ─────────────
    // Numerator: present/present_online = 1.0 pt, half = 0.5 pts
    // Denominator: all records except leave and other (within C-limit, these were converted to absent)
    let overallNum = 0, overallDen = 0;
    for (const r of allRecords) {
      const s = r.status;
      if (s === 'leave' || s === 'other') continue;
      overallDen++;
      if (s === 'present' || s === 'present_online') overallNum += 1;
      else if (s === 'half')                          overallNum += 0.5;
    }
    const overallPct = overallDen > 0
      ? Math.round((overallNum / overallDen) * 1000) / 10
      : 0;
    const totalAttended = allRecords.filter(r =>
      ['present', 'present_online', 'half'].includes(r.status)
    ).length;
    const totalMissed = allRecords.filter(r => r.status === 'absent').length;

    // ── 6. Attendance streak (consecutive present/online days from latest) ─
    // Group by session_date and check if *all* sessions that day were present
    const byDate = {};
    for (const r of allRecords) {
      const date = r.sessions?.session_date;
      if (!date) continue;
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(r.status);
    }
    const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a)); // desc
    let streak = 0;
    for (const date of sortedDates) {
      const statuses = byDate[date];
      const allPresent = statuses.every(s =>
        s === 'present' || s === 'present_online' || s === 'half'
      );
      if (allPresent) streak++;
      else break;
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
    });

  } catch (err) {
    console.error('Attendance summary error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
