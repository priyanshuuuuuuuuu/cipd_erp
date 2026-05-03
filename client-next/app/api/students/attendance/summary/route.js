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

    // 2. Get pre-computed course attendance from student_course_attendance
    const enrolledCourseIds = enrolledCourses.map(c => c.id);
    const { data: courseAttendance, error: caErr } = await supabaseAdmin
      .from('student_course_attendance')
      .select('course_id, attendance_percentage')
      .eq('student_id', studentId)
      .in('course_id', enrolledCourseIds.length > 0 ? enrolledCourseIds : ['00000000-0000-0000-0000-000000000000']);

    if (caErr) console.error('Course attendance fetch error:', caErr.message);

    const pctByCourse = {};
    for (const ca of courseAttendance || []) {
      pctByCourse[ca.course_id] = ca.attendance_percentage;
    }

    // 3. Get all marks for this student to compute overall stats & calendar
    const { data: marks, error: marksErr } = await supabaseAdmin
      .from('student_attendance_marks')
      .select('status, session_date, course_id, session_slot')
      .eq('student_id', studentId)
      .not('course_id', 'is', null); // only linked marks count

    if (marksErr) console.error('Marks fetch error:', marksErr.message);

    const allMarks = marks || [];

    // 4. Build per-course counts from attendance marks
    const countsByCourse = {};
    for (const m of allMarks) {
      const cid = m.course_id;
      if (!cid) continue;
      if (!countsByCourse[cid]) countsByCourse[cid] = { attended: 0, absent: 0, leave: 0, total: 0 };
      countsByCourse[cid].total++;
      const s = m.status;
      if (s === 'P' || s === 'PO' || s === 'H' || s === 'C') {
        countsByCourse[cid].attended++;   // C within limit = attended
      } else if (s === 'A') {
        countsByCourse[cid].absent++;     // penalised absence
      } else if (s === 'L') {
        countsByCourse[cid].leave++;      // official leave
      }
    }

    // 5. Build courses array — use pre-computed % from student_course_attendance
    const courses = enrolledCourses.map(c => {
      const counts = countsByCourse[c.id] || { attended: 0, absent: 0, leave: 0, total: 0 };
      const rawPct = pctByCourse[c.id] ?? 0;
      // Floor at 0 for display; keep actual value for logic
      const pct = Math.max(0, Math.round(rawPct * 10) / 10);
      return {
        course_code: makeCode(c.name),
        course_name: c.name,
        faculty: '',
        attended: counts.attended,
        absent:   counts.absent,
        leave:    counts.leave,
        total:    counts.total,
        pct,
      };
    }).sort((a, b) => a.course_name.localeCompare(b.course_name));

    // 6. Overall stats (across all linked marks)
    let totalAttended = 0, totalAbsent = 0, totalLeave = 0, overallPoints = 0, overallTotal = 0;
    for (const m of allMarks) {
      overallTotal++;
      const s = m.status;
      if (s === 'P' || s === 'PO') { totalAttended++; overallPoints += 1.0; }
      else if (s === 'H')           { totalAttended++; overallPoints += 0.5; }
      else if (s === 'A')           { totalAbsent++;   overallPoints -= 1.0; }
      else if (s === 'C')           { totalAttended++; overallPoints += 1.0; }
      else if (s === 'L')           { totalLeave++;    }
    }
    const overallPct = overallTotal > 0
      ? Math.max(0, Math.round((overallPoints / overallTotal) * 1000) / 10)
      : 0;

    // 7. Streak — consecutive days where all marks were attended
    const byDate = {};
    for (const m of allMarks) {
      if (!m.session_date) continue;
      if (!byDate[m.session_date]) byDate[m.session_date] = [];
      byDate[m.session_date].push(m.status);
    }
    const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));
    let streak = 0;
    for (const date of sortedDates) {
      const statuses = byDate[date];
      const allPresent = statuses.every(s => s === 'P' || s === 'PO' || s === 'H' || s === 'C');
      if (allPresent) streak++;
      else break;
    }

    // 8. Calendar data
    const calByDate = {};
    for (const m of allMarks) {
      if (!m.session_date) continue;
      if (!calByDate[m.session_date]) calByDate[m.session_date] = { present: 0, absent: 0 };
      const s = m.status;
      if (s === 'P' || s === 'PO' || s === 'H' || s === 'C') calByDate[m.session_date].present++;
      else if (s === 'A') calByDate[m.session_date].absent++;
    }
    const calendarData = {};
    for (const [date, { present, absent }] of Object.entries(calByDate)) {
      if (present > 0 && absent === 0) calendarData[date] = 'full';
      else if (present > 0)            calendarData[date] = 'partial';
      else                             calendarData[date] = 'absent';
    }

    // 9. Weekly data
    const weeklyMap = {};
    for (const m of allMarks) {
      if (!m.session_date) continue;
      const d = new Date(m.session_date);
      // Get Monday of the week
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      const weekStr = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
      
      if (!weeklyMap[weekStr]) {
        weeklyMap[weekStr] = { weekStart: weekStr, attended: 0, absent: 0, leave: 0, total: 0, points: 0 };
      }
      weeklyMap[weekStr].total++;
      const s = m.status;
      if (s === 'P' || s === 'PO' || s === 'C') { weeklyMap[weekStr].attended++; weeklyMap[weekStr].points += 1.0; }
      else if (s === 'H')                       { weeklyMap[weekStr].attended++; weeklyMap[weekStr].points += 0.5; }
      else if (s === 'A')                       { weeklyMap[weekStr].absent++;   weeklyMap[weekStr].points -= 1.0; }
      else if (s === 'L')                       { weeklyMap[weekStr].leave++;    }
    }
    const weeklyData = Object.values(weeklyMap).sort((a, b) => a.weekStart.localeCompare(b.weekStart)).map((w, index) => {
      w.pct = w.total > 0 ? Math.max(0, Math.round((w.points / w.total) * 100)) : 0;
      const md = new Date(w.weekStart);
      const ed = new Date(w.weekStart);
      ed.setDate(ed.getDate() + 6);
      
      const startStr = md.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      const endStr = ed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      
      w.label = `Week ${index + 1}`;
      w.dateRange = `${startStr} - ${endStr}`;
      return w;
    });

    return NextResponse.json({
      overall: {
        total:    overallTotal,
        attended: totalAttended,
        absent:   totalAbsent,
        leave:    totalLeave,
        pct:      overallPct,
      },
      streak,
      courses,
      calendarData,
      weeklyData,
    });

  } catch (err) {
    console.error('Attendance summary error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
