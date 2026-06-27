export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';

function makeCode(name = '') {
  return name
    .split(/[\s&]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .join('')
    .slice(0, 4);
}

async function handler(req) {
  try {
    const studentId = req.user.id;

    const { data: enrollments, error: enrollErr } = await supabaseAdmin
      .from('course_enrollments')
      .select('course_id, courses ( id, name )')
      .eq('student_id', studentId);

    if (enrollErr) console.error('Enrollment fetch error:', enrollErr.message);

    const enrolledCourses = (enrollments || []).map((e) => ({
      id: e.courses?.id || e.course_id,
      name: e.courses?.name || 'Unknown',
    }));

    const enrolledCourseIds = enrolledCourses.map((c) => c.id);

    let records = [];
    if (enrolledCourseIds.length > 0) {
      const { data: recs, error: recErr } = await supabaseAdmin
        .from('attendance_records')
        .select(`
          status, points, session_id,
          sessions!inner (
            id, session_date, course_id, status
          )
        `)
        .eq('student_id', studentId)
        .in('sessions.course_id', enrolledCourseIds)
        .eq('sessions.status', 'completed');

      if (recErr) console.error('Attendance records fetch error:', recErr.message);
      records = recs || [];
    }

    const countsByCourse = {};
    for (const r of records) {
      const cid = r.sessions?.course_id;
      if (!cid) continue;
      if (!countsByCourse[cid]) {
        countsByCourse[cid] = { attended: 0, absent: 0, leave: 0, total: 0, points: 0 };
      }
      countsByCourse[cid].total++;
      countsByCourse[cid].points += Number(r.points) || 0;

      if (r.status === 'present' || r.status === 'partial') {
        countsByCourse[cid].attended++;
      } else if (r.status === 'leave') {
        countsByCourse[cid].leave++;
      } else {
        countsByCourse[cid].absent++;
      }
    }

    const courses = enrolledCourses
      .map((c) => {
        const counts = countsByCourse[c.id] || {
          attended: 0,
          absent: 0,
          leave: 0,
          total: 0,
          points: 0,
        };
        const maxPoints = counts.total * 5;
        const pct =
          maxPoints > 0
            ? Math.max(0, Math.round((counts.points / maxPoints) * 1000) / 10)
            : 0;
        return {
          course_code: makeCode(c.name),
          course_name: c.name,
          faculty: '',
          attended: counts.attended,
          absent: counts.absent,
          leave: counts.leave,
          total: counts.total,
          pct,
        };
      })
      .sort((a, b) => a.course_name.localeCompare(b.course_name));

    let totalAttended = 0;
    let totalAbsent = 0;
    let totalLeave = 0;
    let overallPoints = 0;
    let overallTotal = 0;

    for (const r of records) {
      overallTotal++;
      overallPoints += Number(r.points) || 0;
      if (r.status === 'present' || r.status === 'partial') totalAttended++;
      else if (r.status === 'leave') totalLeave++;
      else totalAbsent++;
    }

    const overallPct =
      overallTotal > 0
        ? Math.max(
            0,
            Math.round((overallPoints / (overallTotal * 5)) * 1000) / 10
          )
        : 0;

    const byDate = {};
    for (const r of records) {
      const date = r.sessions?.session_date;
      if (!date) continue;
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(r.status);
    }

    const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));
    let streak = 0;
    for (const date of sortedDates) {
      const statuses = byDate[date];
      const allPresent = statuses.every(
        (s) => s === 'present' || s === 'partial' || s === 'leave'
      );
      if (allPresent) streak++;
      else break;
    }

    const calByDate = {};
    for (const r of records) {
      const date = r.sessions?.session_date;
      if (!date) continue;
      if (!calByDate[date]) calByDate[date] = { present: 0, absent: 0 };
      if (r.status === 'present' || r.status === 'partial' || r.status === 'leave') {
        calByDate[date].present++;
      } else {
        calByDate[date].absent++;
      }
    }

    const calendarData = {};
    for (const [date, { present, absent }] of Object.entries(calByDate)) {
      if (present > 0 && absent === 0) calendarData[date] = 'full';
      else if (present > 0) calendarData[date] = 'partial';
      else calendarData[date] = 'absent';
    }

    const weeklyMap = {};
    for (const r of records) {
      const dateStr = r.sessions?.session_date;
      if (!dateStr) continue;
      const d = new Date(`${dateStr}T12:00:00`);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d);
      monday.setDate(diff);
      const weekStr = monday.toISOString().split('T')[0];

      if (!weeklyMap[weekStr]) {
        weeklyMap[weekStr] = {
          weekStart: weekStr,
          attended: 0,
          absent: 0,
          leave: 0,
          total: 0,
          points: 0,
        };
      }
      weeklyMap[weekStr].total++;
      weeklyMap[weekStr].points += Number(r.points) || 0;
      if (r.status === 'present' || r.status === 'partial') {
        weeklyMap[weekStr].attended++;
      } else if (r.status === 'leave') {
        weeklyMap[weekStr].leave++;
      } else {
        weeklyMap[weekStr].absent++;
      }
    }

    const weeklyData = Object.values(weeklyMap)
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
      .map((w, index) => {
        const pct =
          w.total > 0
            ? Math.max(0, Math.round((w.points / (w.total * 5)) * 100))
            : 0;
        const md = new Date(w.weekStart);
        const ed = new Date(w.weekStart);
        ed.setDate(ed.getDate() + 6);
        return {
          ...w,
          pct,
          label: `Week ${index + 1}`,
          dateRange: `${md.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${ed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
        };
      });

    return NextResponse.json({
      overall: {
        total: overallTotal,
        attended: totalAttended,
        absent: totalAbsent,
        leave: totalLeave,
        pct: overallPct,
        points: Math.round(overallPoints * 10) / 10,
      },
      streak,
      courses,
      calendarData,
      weeklyData,
      source: 'attendance_records',
    });
  } catch (err) {
    console.error('Attendance summary error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
