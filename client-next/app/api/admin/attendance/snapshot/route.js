import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }

    // Get session details
    const { data: session } = await supabaseAdmin
      .from('sessions')
      .select(`
        id, title, session_date, start_time, end_time, status,
        courses ( id, name ),
        faculty ( id, users ( first_name, last_name ) ),
        venues ( id, name, building, router_bssid )
      `)
      .eq('id', sessionId)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Get enrolled students for this course
    const { data: enrollments } = await supabaseAdmin
      .from('course_enrollments')
      .select(`
        student_id,
        students (
          id, enrollment_no, mac_address, mac_verified, device_hash,
          users ( first_name, last_name )
        )
      `)
      .eq('course_id', session.courses?.id);

    // Get attendance records for this session
    const { data: records } = await supabaseAdmin
      .from('attendance_records')
      .select('student_id, ping_count, status, calculated_at')
      .eq('session_id', sessionId);

    // Get ping logs for this session
    const { data: pings } = await supabaseAdmin
      .from('attendance_ping_logs')
      .select('student_id, device_hash, bssid, signal_strength, ping_time')
      .eq('session_id', sessionId)
      .order('ping_time', { ascending: false });

    // Build student attendance list
    const students = (enrollments || []).map(e => {
      const s = e.students;
      const record = (records || []).find(r => r.student_id === e.student_id);
      const studentPings = (pings || []).filter(p => p.student_id === e.student_id);
      const lastPing = studentPings[0];

      return {
        student_id: e.student_id,
        name: `${s?.users?.first_name || ''} ${s?.users?.last_name || ''}`.trim(),
        enrollment_no: s?.enrollment_no || '',
        mac_address: s?.mac_address || null,
        mac_verified: s?.mac_verified || false,
        pings: record?.ping_count || studentPings.length,
        status: record?.status || (studentPings.length >= 3 ? 'present' : studentPings.length >= 1 ? 'partial' : 'absent'),
        last_seen: lastPing?.ping_time || null,
      };
    });

    const presentCount = students.filter(s => s.status === 'present').length;
    const absentCount = students.filter(s => s.status === 'absent').length;

    return NextResponse.json({
      session,
      students,
      summary: {
        total: students.length,
        present: presentCount,
        absent: absentCount,
        partial: students.length - presentCount - absentCount,
      },
    });
  } catch (err) {
    console.error('Admin attendance snapshot error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(handler, ['admin']);
