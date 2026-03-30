export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

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
  let query = supabaseAdmin
    .from('attendance_records')
    .select(`
      status, ping_count, calculated_at,
      students ( enrollment_no, users!inner ( first_name, last_name, email ) ),
      sessions!inner ( session_date, start_time, title,
        courses!inner ( name )
      )
    `)
    .order('calculated_at', { ascending: false });

  if (dateFrom) query = query.gte('sessions.session_date', dateFrom);
  if (dateTo)   query = query.lte('sessions.session_date', dateTo);
  if (courseId && courseId !== 'all') query = query.eq('sessions.course_id', courseId);

  const { data, error } = await query;
  if (error) throw error;

  const headers = ['Enrollment No', 'Student Name', 'Email', 'Session Date', 'Session Title', 'Course', 'Start Time', 'Status', 'Ping Count', 'Calculated At'];
  const rows = (data || []).map(r => ({
    'Enrollment No':   r.students?.enrollment_no || '',
    'Student Name':    r.students?.users ? `${r.students.users.first_name} ${r.students.users.last_name}` : '',
    'Email':           r.students?.users?.email || '',
    'Session Date':    r.sessions?.session_date || '',
    'Session Title':   r.sessions?.title || '',
    'Course':          r.sessions?.courses?.name || '',
    'Start Time':      r.sessions?.start_time?.slice(0, 5) || '',
    'Status':          r.status || '',
    'Ping Count':      r.ping_count ?? '',
    'Calculated At':   r.calculated_at ? new Date(r.calculated_at).toLocaleString('en-GB') : '',
  }));

  return toCSV(headers, rows);
}

async function buildFeedbackCSV({ dateFrom, dateTo, courseId }) {
  let query = supabaseAdmin
    .from('feedback_responses')
    .select(`
      rating, yes_no, text_answer, submitted_at,
      students ( enrollment_no, users!inner ( first_name, last_name ) ),
      sessions!inner ( session_date, title, courses!inner ( name ) ),
      feedback_questions ( question, type )
    `)
    .order('submitted_at', { ascending: false });

  if (dateFrom) query = query.gte('sessions.session_date', dateFrom);
  if (dateTo)   query = query.lte('sessions.session_date', dateTo);
  if (courseId && courseId !== 'all') query = query.eq('sessions.course_id', courseId);

  const { data, error } = await query;
  if (error) throw error;

  const headers = ['Student Name', 'Enrollment No', 'Course', 'Session', 'Session Date', 'Question', 'Type', 'Rating', 'Yes/No', 'Text Answer', 'Submitted At'];
  const rows = (data || []).map(r => ({
    'Student Name':    r.students?.users ? `${r.students.users.first_name} ${r.students.users.last_name}` : '',
    'Enrollment No':   r.students?.enrollment_no || '',
    'Course':          r.sessions?.courses?.name || '',
    'Session':         r.sessions?.title || '',
    'Session Date':    r.sessions?.session_date || '',
    'Question':        r.feedback_questions?.question || '',
    'Type':            r.feedback_questions?.type || '',
    'Rating':          r.rating ?? '',
    'Yes/No':          r.yes_no != null ? (r.yes_no ? 'Yes' : 'No') : '',
    'Text Answer':     r.text_answer || '',
    'Submitted At':    r.submitted_at ? new Date(r.submitted_at).toLocaleString('en-GB') : '',
  }));

  return toCSV(headers, rows);
}

async function buildFacultyCSV({ dateFrom, dateTo, facultyId }) {
  let query = supabaseAdmin
    .from('sessions')
    .select(`
      session_date, start_time, end_time, title, status,
      courses ( name ),
      faculty:faculty_id ( designation,
        users!inner ( first_name, last_name, email )
      )
    `)
    .eq('status', 'completed')
    .order('session_date', { ascending: false });

  if (dateFrom)   query = query.gte('session_date', dateFrom);
  if (dateTo)     query = query.lte('session_date', dateTo);
  if (facultyId && facultyId !== 'all') query = query.eq('faculty_id', facultyId);

  const { data, error } = await query;
  if (error) throw error;

  const headers = ['Faculty Name', 'Email', 'Designation', 'Course', 'Session Title', 'Session Date', 'Start Time', 'End Time', 'Duration (hrs)'];
  const rows = (data || []).map(s => {
    const start = new Date(`1970-01-01T${s.start_time}Z`);
    const end   = new Date(`1970-01-01T${s.end_time}Z`);
    const hours = ((end - start) / 3600000).toFixed(2);
    return {
      'Faculty Name':    s.faculty?.users ? `${s.faculty.users.first_name} ${s.faculty.users.last_name}` : '',
      'Email':           s.faculty?.users?.email || '',
      'Designation':     s.faculty?.designation || '',
      'Course':          s.courses?.name || '',
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
  let query = supabaseAdmin
    .from('attendance_ping_logs')
    .select(`
      device_hash, bssid, signal_strength, ping_time,
      students ( enrollment_no, mac_address, users!inner ( first_name, last_name ) ),
      sessions ( title, session_date )
    `)
    .order('ping_time', { ascending: false })
    .limit(5000);

  if (dateFrom) query = query.gte('ping_time', dateFrom);
  if (dateTo)   query = query.lte('ping_time', dateTo + 'T23:59:59');

  const { data, error } = await query;
  if (error) throw error;

  const headers = ['Student Name', 'Enrollment No', 'MAC Address', 'BSSID', 'Signal Strength', 'Session', 'Session Date', 'Ping Time'];
  const rows = (data || []).map(r => ({
    'Student Name':    r.students?.users ? `${r.students.users.first_name} ${r.students.users.last_name}` : '',
    'Enrollment No':   r.students?.enrollment_no || '',
    'MAC Address':     r.students?.mac_address || '',
    'BSSID':           r.bssid || '',
    'Signal Strength': r.signal_strength ?? '',
    'Session':         r.sessions?.title || '',
    'Session Date':    r.sessions?.session_date || '',
    'Ping Time':       r.ping_time ? new Date(r.ping_time).toLocaleString('en-GB') : '',
  }));

  return toCSV(headers, rows);
}

async function buildSessionsCSV({ dateFrom, dateTo, courseId, facultyId }) {
  let query = supabaseAdmin
    .from('sessions')
    .select(`
      session_date, start_time, end_time, title, status,
      courses ( name ),
      faculty:faculty_id ( users!inner ( first_name, last_name ) ),
      venues ( name, building )
    `)
    .order('session_date', { ascending: false });

  if (dateFrom)   query = query.gte('session_date', dateFrom);
  if (dateTo)     query = query.lte('session_date', dateTo);
  if (courseId && courseId !== 'all')   query = query.eq('course_id', courseId);
  if (facultyId && facultyId !== 'all') query = query.eq('faculty_id', facultyId);

  const { data, error } = await query;
  if (error) throw error;

  const headers = ['Session Title', 'Course', 'Faculty', 'Venue', 'Building', 'Date', 'Start', 'End', 'Duration (hrs)', 'Status'];
  const rows = (data || []).map(s => {
    const start = new Date(`1970-01-01T${s.start_time}Z`);
    const end   = new Date(`1970-01-01T${s.end_time}Z`);
    const hours = ((end - start) / 3600000).toFixed(2);
    return {
      'Session Title':  s.title || '',
      'Course':         s.courses?.name || '',
      'Faculty':        s.faculty?.users ? `${s.faculty.users.first_name} ${s.faculty.users.last_name}` : '',
      'Venue':          s.venues?.name || '',
      'Building':       s.venues?.building || '',
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

  const timestamp = new Date().toISOString().split('T')[0];
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
