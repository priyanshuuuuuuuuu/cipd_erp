export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getSchemaDb, getCohortConfig } from '@/lib/db';
import { students, users, courseEnrollments, courses, attendanceRecords, sessions } from '@/drizzle/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';
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
    const schemaDb = getSchemaDb(requestedSchema);

    const [student] = await schemaDb
      .select({
        id: students.id,
        enrollment_no: students.enrollmentNo,
        program_name: students.programName,
        first_name: users.firstName,
        last_name: users.lastName,
        email: users.email,
      })
      .from(students)
      .leftJoin(users, eq(students.userId, users.id))
      .where(eq(students.id, studentId))
      .limit(1);

    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

    const enrollments = await schemaDb
      .select({
        course_id: courseEnrollments.courseId,
        course_name: courses.name,
      })
      .from(courseEnrollments)
      .leftJoin(courses, eq(courseEnrollments.courseId, courses.id))
      .where(eq(courseEnrollments.studentId, studentId));

    const enrolledCourses = enrollments.map(e => ({
      id: e.course_id,
      name: e.course_name || 'Unknown',
    }));
    const enrolledCourseIds = enrolledCourses.map(c => c.id).filter(Boolean);

    let records = [];
    if (enrolledCourseIds.length > 0) {
      records = await schemaDb
        .select({
          status: attendanceRecords.status,
          points: attendanceRecords.points,
          session_id: attendanceRecords.sessionId,
          ping_count: attendanceRecords.pingCount,
          session: {
            id: sessions.id,
            session_date: sessions.sessionDate,
            start_time: sessions.startTime,
            end_time: sessions.endTime,
            title: sessions.title,
            course_id: sessions.courseId,
            status: sessions.status,
          },
          course_name: courses.name,
        })
        .from(attendanceRecords)
        .innerJoin(sessions, eq(attendanceRecords.sessionId, sessions.id))
        .leftJoin(courses, eq(sessions.courseId, courses.id))
        .where(
          and(
            eq(attendanceRecords.studentId, studentId),
            inArray(sessions.courseId, enrolledCourseIds),
            eq(sessions.status, 'completed')
          )
        )
        .orderBy(desc(sessions.sessionDate));
    }

    // Per-course stats
    const countsByCourse = {};
    for (const r of records) {
      const cid = r.session?.course_id;
      if (!cid) continue;
      if (!countsByCourse[cid]) countsByCourse[cid] = { attended: 0, absent: 0, leave: 0, total: 0, points: 0 };
      countsByCourse[cid].total++;
      countsByCourse[cid].points += Number(r.points) || 0;
      if (r.status === 'present' || r.status === 'partial') countsByCourse[cid].attended++;
      else if (r.status === 'leave') countsByCourse[cid].leave++;
      else countsByCourse[cid].absent++;
    }

    const resCourses = enrolledCourses.map(c => {
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
    // Score breakdown: gross = net + deductions, negative = absent × 2
    const negativePoints = totalAbsent * 2;
    const grossPoints = Math.round((overallPoints + negativePoints) * 10) / 10;

    // Streak
    const byDate = {};
    for (const r of records) {
      const date = r.session?.session_date;
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

    // Recent sessions (last 10)
    const recentSessions = records.slice(0, 10).map(r => {
      const sess = r.session || {};
      const dateStr = sess.session_date || '';
      const d = dateStr ? new Date(dateStr + 'T00:00:00') : null;
      return {
        date: d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'N/A',
        day: d ? d.toLocaleDateString('en-GB', { weekday: 'short' }) : '',
        date_raw: dateStr,
        start_time: sess.start_time ? sess.start_time.slice(0, 5) : '',
        end_time: sess.end_time ? sess.end_time.slice(0, 5) : '',
        title: sess.title || r.course_name || 'Session',
        course_name: r.course_name || '',
        course_code: makeCode(r.course_name || ''),
        status: r.status,
        ping_count: r.ping_count || 0,
        points: r.points != null ? Number(r.points) : null,
      };
    });

    return NextResponse.json({
      student: {
        id: student.id,
        name: `${student.first_name || ''} ${student.last_name || ''}`.trim(),
        email: student.email || '',
        enrollment_no: student.enrollment_no || '',
        program_name: student.program_name || '',
      },
      overall: {
        total: overallTotal,
        attended: totalAttended,
        absent: totalAbsent,
        leave: totalLeave,
        pct: overallPct,
        points: Math.round(overallPoints * 10) / 10,       // net score
        grossPoints,                                         // earned before deductions
        negativePoints,                                      // absent × 2 deduction
        maxPoints: overallTotal * 5,
      },
      streak,
      courses: resCourses,
      recentSessions,
      schema: requestedSchema,
    });
  } catch (err) {
    console.error('Admin attendance summary error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(handler, ['admin']);

