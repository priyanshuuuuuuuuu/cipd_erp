export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  attendanceRecords,
  students,
  users,
  sessions,
  courses,
  feedbackResponses,
  feedbackQuestions,
  faculty,
  attendancePingLogs,
  venues,
} from '@/drizzle/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';
import { getISTDateString } from '@/lib/ist-date';

// ── helpers ───────────────────────────────────────────────────────────────────

function toCSV(headers, rows) {
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => escape(row[h])).join(','));
  }
  return lines.join('\r\n');
}

function csvResponse(csv, filename) {
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

// ── report builders ───────────────────────────────────────────────────────────

async function buildAttendanceCSV({ dateFrom, dateTo, courseId }) {
  const conditions = [];
  if (dateFrom) conditions.push(gte(sessions.sessionDate, dateFrom));
  if (dateTo) conditions.push(lte(sessions.sessionDate, dateTo));
  if (courseId && courseId !== 'all') conditions.push(eq(sessions.courseId, courseId));

  const rowsData = await db
    .select({
      status: attendanceRecords.status,
      ping_count: attendanceRecords.pingCount,
      calculated_at: attendanceRecords.calculatedAt,
      enrollment_no: students.enrollmentNo,
      first_name: users.firstName,
      last_name: users.lastName,
      email: users.email,
      session_date: sessions.sessionDate,
      start_time: sessions.startTime,
      session_title: sessions.title,
      course_name: courses.name,
    })
    .from(attendanceRecords)
    .innerJoin(students, eq(attendanceRecords.studentId, students.id))
    .innerJoin(users, eq(students.id, users.id))
    .innerJoin(sessions, eq(attendanceRecords.sessionId, sessions.id))
    .innerJoin(courses, eq(sessions.courseId, courses.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(attendanceRecords.calculatedAt));

  const headers = ['Enrollment No', 'Student Name', 'Email', 'Session Date', 'Session Title', 'Course', 'Start Time', 'Status', 'Ping Count', 'Calculated At'];
  const rows = rowsData.map(r => ({
    'Enrollment No':   r.enrollment_no || '',
    'Student Name':    r.first_name || r.last_name ? `${r.first_name || ''} ${r.last_name || ''}`.trim() : '',
    'Email':           r.email || '',
    'Session Date':    r.session_date || '',
    'Session Title':   r.session_title || '',
    'Course':          r.course_name || '',
    'Start Time':      r.start_time?.slice(0, 5) || '',
    'Status':          r.status || '',
    'Ping Count':      r.ping_count ?? '',
    'Calculated At':   r.calculated_at ? new Date(r.calculated_at).toLocaleString('en-GB') : '',
  }));

  return toCSV(headers, rows);
}

async function buildFeedbackCSV({ dateFrom, dateTo, courseId }) {
  const conditions = [];
  if (dateFrom) conditions.push(gte(sessions.sessionDate, dateFrom));
  if (dateTo) conditions.push(lte(sessions.sessionDate, dateTo));
  if (courseId && courseId !== 'all') conditions.push(eq(sessions.courseId, courseId));

  const rowsData = await db
    .select({
      rating: feedbackResponses.rating,
      yes_no: feedbackResponses.yesNo,
      text_answer: feedbackResponses.textAnswer,
      submitted_at: feedbackResponses.submittedAt,
      enrollment_no: students.enrollmentNo,
      first_name: users.firstName,
      last_name: users.lastName,
      session_date: sessions.sessionDate,
      session_title: sessions.title,
      course_name: courses.name,
      question: feedbackQuestions.question,
      question_type: feedbackQuestions.type,
    })
    .from(feedbackResponses)
    .leftJoin(students, eq(feedbackResponses.studentId, students.id))
    .leftJoin(users, eq(students.id, users.id))
    .innerJoin(sessions, eq(feedbackResponses.sessionId, sessions.id))
    .innerJoin(courses, eq(sessions.courseId, courses.id))
    .leftJoin(feedbackQuestions, eq(feedbackResponses.questionId, feedbackQuestions.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(feedbackResponses.submittedAt));

  const headers = ['Student Name', 'Enrollment No', 'Course', 'Session', 'Session Date', 'Question', 'Type', 'Rating', 'Yes/No', 'Text Answer', 'Submitted At'];
  const rows = rowsData.map(r => ({
    'Student Name':    r.first_name || r.last_name ? `${r.first_name || ''} ${r.last_name || ''}`.trim() : '',
    'Enrollment No':   r.enrollment_no || '',
    'Course':          r.course_name || '',
    'Session':         r.session_title || '',
    'Session Date':    r.session_date || '',
    'Question':        r.question || '',
    'Type':            r.question_type || '',
    'Rating':          r.rating ?? '',
    'Yes/No':          r.yes_no != null ? (r.yes_no ? 'Yes' : 'No') : '',
    'Text Answer':     r.text_answer || '',
    'Submitted At':    r.submitted_at ? new Date(r.submitted_at).toLocaleString('en-GB') : '',
  }));

  return toCSV(headers, rows);
}

async function buildFacultyCSV({ dateFrom, dateTo, facultyId }) {
  const conditions = [eq(sessions.status, 'completed')];
  if (dateFrom) conditions.push(gte(sessions.sessionDate, dateFrom));
  if (dateTo) conditions.push(lte(sessions.sessionDate, dateTo));
  if (facultyId && facultyId !== 'all') conditions.push(eq(sessions.facultyId, facultyId));

  const rowsData = await db
    .select({
      session_date: sessions.sessionDate,
      start_time: sessions.startTime,
      end_time: sessions.endTime,
      title: sessions.title,
      status: sessions.status,
      course_name: courses.name,
      designation: faculty.designation,
      first_name: users.firstName,
      last_name: users.lastName,
      email: users.email,
    })
    .from(sessions)
    .leftJoin(courses, eq(sessions.courseId, courses.id))
    .leftJoin(faculty, eq(sessions.facultyId, faculty.id))
    .leftJoin(users, eq(faculty.id, users.id))
    .where(and(...conditions))
    .orderBy(desc(sessions.sessionDate));

  const headers = ['Faculty Name', 'Email', 'Designation', 'Course', 'Session Title', 'Session Date', 'Start Time', 'End Time', 'Duration (hrs)'];
  const rows = rowsData.map(s => {
    const start = new Date(`1970-01-01T${s.start_time}Z`);
    const end   = new Date(`1970-01-01T${s.end_time}Z`);
    const hours = ((end - start) / 3600000).toFixed(2);
    return {
      'Faculty Name':    s.first_name || s.last_name ? `${s.first_name || ''} ${s.last_name || ''}`.trim() : '',
      'Email':           s.email || '',
      'Designation':     s.designation || '',
      'Course':          s.course_name || '',
      'Session Title':   s.title || '',
      'Session Date':    s.session_date || '',
      'Start Time':      s.start_time?.slice(0, 5) || '',
      'End Time':        s.end_time?.slice(0, 5) || '',
      'Duration (hrs)':  hours,
    };
  });

  return toCSV(headers, rows);
}

async function buildWifiCSV({ dateFrom, dateTo }) {
  const conditions = [];
  if (dateFrom) conditions.push(gte(attendancePingLogs.pingTime, dateFrom));
  if (dateTo) conditions.push(lte(attendancePingLogs.pingTime, dateTo + 'T23:59:59'));

  const rowsData = await db
    .select({
      device_hash: attendancePingLogs.deviceHash,
      bssid: attendancePingLogs.bssid,
      signal_strength: attendancePingLogs.signalStrength,
      ping_time: attendancePingLogs.pingTime,
      enrollment_no: students.enrollmentNo,
      mac_address: students.macAddress,
      first_name: users.firstName,
      last_name: users.lastName,
      session_title: sessions.title,
      session_date: sessions.sessionDate,
    })
    .from(attendancePingLogs)
    .leftJoin(students, eq(attendancePingLogs.studentId, students.id))
    .leftJoin(users, eq(students.id, users.id))
    .leftJoin(sessions, eq(attendancePingLogs.sessionId, sessions.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(attendancePingLogs.pingTime))
    .limit(5000);

  const headers = ['Student Name', 'Enrollment No', 'MAC Address', 'BSSID', 'Signal Strength', 'Session', 'Session Date', 'Ping Time'];
  const rows = rowsData.map(r => ({
    'Student Name':    r.first_name || r.last_name ? `${r.first_name || ''} ${r.last_name || ''}`.trim() : '',
    'Enrollment No':   r.enrollment_no || '',
    'MAC Address':     r.mac_address || '',
    'BSSID':           r.bssid || '',
    'Signal Strength': r.signal_strength ?? '',
    'Session':         r.session_title || '',
    'Session Date':    r.session_date || '',
    'Ping Time':       r.ping_time ? new Date(r.ping_time).toLocaleString('en-GB') : '',
  }));

  return toCSV(headers, rows);
}

async function buildSessionsCSV({ dateFrom, dateTo, courseId, facultyId }) {
  const conditions = [];
  if (dateFrom) conditions.push(gte(sessions.sessionDate, dateFrom));
  if (dateTo) conditions.push(lte(sessions.sessionDate, dateTo));
  if (courseId && courseId !== 'all') conditions.push(eq(sessions.courseId, courseId));
  if (facultyId && facultyId !== 'all') conditions.push(eq(sessions.facultyId, facultyId));

  const rowsData = await db
    .select({
      session_date: sessions.sessionDate,
      start_time: sessions.startTime,
      end_time: sessions.endTime,
      title: sessions.title,
      status: sessions.status,
      course_name: courses.name,
      first_name: users.firstName,
      last_name: users.lastName,
      venue_name: venues.name,
      venue_building: venues.building,
    })
    .from(sessions)
    .leftJoin(courses, eq(sessions.courseId, courses.id))
    .leftJoin(faculty, eq(sessions.facultyId, faculty.id))
    .leftJoin(users, eq(faculty.id, users.id))
    .leftJoin(venues, eq(sessions.venueId, venues.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(sessions.sessionDate));

  const headers = ['Session Title', 'Course', 'Faculty', 'Venue', 'Building', 'Date', 'Start', 'End', 'Duration (hrs)', 'Status'];
  const rows = rowsData.map(s => {
    const start = new Date(`1970-01-01T${s.start_time}Z`);
    const end   = new Date(`1970-01-01T${s.end_time}Z`);
    const hours = ((end - start) / 3600000).toFixed(2);
    return {
      'Session Title':  s.title || '',
      'Course':         s.course_name || '',
      'Faculty':        s.first_name || s.last_name ? `${s.first_name || ''} ${s.last_name || ''}`.trim() : '',
      'Venue':          s.venue_name || '',
      'Building':       s.venue_building || '',
      'Date':           s.session_date || '',
      'Start':          s.start_time?.slice(0, 5) || '',
      'End':            s.end_time?.slice(0, 5) || '',
      'Duration (hrs)': hours,
      'Status':         s.status || '',
    };
  });

  return toCSV(headers, rows);
}

// ── main handler ──────────────────────────────────────────────────────────────

async function handler(request) {
  const { searchParams } = new URL(request.url);
  const type      = searchParams.get('type')     || 'attendance';  // attendance | feedback | faculty | wifi | sessions
  const dateFrom  = searchParams.get('dateFrom') || null;
  const dateTo    = searchParams.get('dateTo')   || null;
  const courseId  = searchParams.get('courseId') || 'all';
  const facultyId = searchParams.get('facultyId')|| 'all';

  const timestamp = getISTDateString(); // IST date for filename
  const filename  = `cipd_${type}_report_${timestamp}.csv`;

  try {
    let csv = '';

    switch (type) {
      case 'attendance':
        csv = await buildAttendanceCSV({ dateFrom, dateTo, courseId });
        break;
      case 'feedback':
        csv = await buildFeedbackCSV({ dateFrom, dateTo, courseId });
        break;
      case 'faculty':
        csv = await buildFacultyCSV({ dateFrom, dateTo, facultyId });
        break;
      case 'wifi':
        csv = await buildWifiCSV({ dateFrom, dateTo });
        break;
      case 'sessions':
        csv = await buildSessionsCSV({ dateFrom, dateTo, courseId, facultyId });
        break;
      default:
        return NextResponse.json({ error: `Unknown report type: ${type}` }, { status: 400 });
    }

    // Add BOM for Excel UTF-8 compatibility
    return csvResponse('\uFEFF' + csv, filename);

  } catch (err) {
    console.error('CSV export error:', err);
    return NextResponse.json({ error: 'Failed to generate report: ' + err.message }, { status: 500 });
  }
}

export const GET = withRole(handler, ['admin']);
