export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');
    const studentId = searchParams.get('student_id');
    const status = searchParams.get('status');

    if (!sessionId || !studentId || !status) {
      return NextResponse.json({ error: 'session_id, student_id, and status are required' }, { status: 400 });
    }

    if (!['present', 'absent', 'partial'].includes(status)) {
      return NextResponse.json({ error: 'status must be present, absent, or partial' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('attendance_records')
      .upsert({
        session_id: sessionId,
        student_id: studentId,
        status,
        calculated_at: new Date().toISOString(),
      }, { onConflict: 'session_id,student_id' })
      .select()
      .single();

    if (error) {
      console.error('Attendance override error:', error);
      return NextResponse.json({ error: 'Failed to override attendance' }, { status: 500 });
    }

    return NextResponse.json({ record: data, message: 'Attendance overridden successfully' });
  } catch (err) {
    console.error('Attendance override error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const PATCH = withRole(handler, ['admin']);
