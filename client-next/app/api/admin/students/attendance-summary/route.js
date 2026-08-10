export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getSchemaClient, getCohortConfig } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

// GET /api/admin/students/attendance-summary?student_id=<uuid>&schema=july
function makeCode(name = '') {
  return name.split(/[\s&]+/).filter(Boolean).map(w => w[0].toUpperCase()).join('').slice(0, 4);
}

async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get('student_id');
    const requestedSchema = searchParams.get('schema') || 'july';

    if (!studentId) return NextResponse.json({ error: 'student_id is required' }, { status: 400 });

    // Validate schema against allowlist
    const { schemas } = getCohortConfig();
    if (!schemas.includes(requestedSchema)) {
      return NextResponse.json({ error: 'Invalid schema' }, { status: 400 });
    }
    const db = getSchemaClient(requestedSchema);

    const { data: student } = await db
      .from('students')
      .select('id, enrollment_no, program_name, users ( first_name, last_name, email )')
      .eq('id', studentId)
      .maybeSingle();

    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

    const { data: enrollments } = await db
      .from('course_enrollments')
      .select('course_id, courses ( id, name )')
      .eq('student_id', studentId);

    const enrolledCourses = (enrollments || []).map(e => ({
      id: e.courses?.id || e.course_id,
      name: e.courses?.name || 'Unknown',
    }));
    const enrolledCourseIds = enrolledCourses.map(c => c.id);

    let records = [];
    if (enrolledCourseIds.length > 0) {
      const { data: recs } = await db
        .from('attendance_records')
        .select(`
          status, points, session_id, ping_count,
          sessions!inner (
            id, session_date, start_time, end_time, title, course_id, status,
            courses ( name )
          )
        `)
        .eq('student_id', studentId)
        .in('sessions.course_id', enrolledCourseIds)
        .eq('sessions.status', 'completed')
        .order('sessions(session_date)', { ascending: false });

      records = recs || [];
    }

    // Per-course stats
    const countsByCourse = {};
    for (const r of records) {
      const cid = r.sessions?.course_id;
      if (!cid) continue;
      if (!countsByCourse[cid]) countsByCourse[cid] = { attended: 0, absent: 0, leave: 0, total: 0, points: 0 };
      countsByCourse[cid].total++;
      countsByCourse[cid].points += Number(r.points) || 0;
      if (r.status === 'present' || r.status === 'partial') countsByCourse[cid].attended++;
      else if (r.status === 'leave') countsByCourse[cid].leave++;
      else countsByCourse[cid].absent++;
    }

    const courses = enrolledCourses.map(c => {
      const counts = countsByCourse[c.id] || { attended: 0, absent: 0, leave: 0, total: 0, points: 0 };
      const maxPoints = counts.total * 5;
      const pct = maxPoints > 0 ? Math.max(0, Math.round((counts.points / maxPoints) * 1000) / 10) : 0;
      return { course_code: makeCode(c.name), course_name: c.name, attended: counts.attended, absent: counts.absent, leave: counts.leave, total: counts.total, pct };
    }).sort((a, b) => a.course_name.localeCompare(b.course_name));

    // Overall stats
    let totalAttended = 0, totalAbsent = 0, totalLeave = 0, overallPoints = 0, overallTotal = 0;
    for (const r of records) {
      overallTotal++;
      overallPoints += Number(r.points) || 0;
      if (r.status === 'present' || r.status === 'partial') totalAttended++;
      else if (r.status === 'leave') totalLeave++;
      else totalAbsent++;
    }
    const overallPct = overallTotal > 0 ? Math.max(0, Math.round((overallPoints / (overallTotal * 5)) * 1000) / 10) : 0;

    // Streak
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
      if (byDate[date].every(s => s === 'present' || s === 'partial' || s === 'leave')) streak++;
      else break;
    }

    // Recent sessions (last 20)
    const recentSessions = records.slice(0, 20).map(r => {
      const sess = r.sessions || {};
      const dateStr = sess.session_date || '';
      const d = dateStr ? new Date(dateStr + 'T00:00:00') : null;
      return {
        date: d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'N/A',
        day: d ? d.toLocaleDateString('en-GB', { weekday: 'short' }) : '',
        date_raw: dateStr,
        start_time: sess.start_time ? sess.start_time.slice(0, 5) : '',
        end_time: sess.end_time ? sess.end_time.slice(0, 5) : '',
        title: sess.title || sess.courses?.name || 'Session',
        course_name: sess.courses?.name || '',
        course_code: makeCode(sess.courses?.name || ''),
        status: r.status,
        ping_count: r.ping_count || 0,
        points: r.points ?? null,
      };
    });

    return NextResponse.json({
      student: {
        id: student.id,
        name: `${student.users?.first_name || ''} ${student.users?.last_name || ''}`.trim(),
        email: student.users?.email || '',
        enrollment_no: student.enrollment_no || '',
        program_name: student.program_name || '',
      },
      overall: { total: overallTotal, attended: totalAttended, absent: totalAbsent, leave: totalLeave, pct: overallPct, points: Math.round(overallPoints * 10) / 10 },
      streak,
      courses,
      recentSessions,
      schema: requestedSchema,
    });
  } catch (err) {
    console.error('Admin attendance summary error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(handler, ['admin']);
