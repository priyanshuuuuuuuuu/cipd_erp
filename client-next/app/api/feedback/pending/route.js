export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';

async function handler(req) {
  try {
    // Get sessions where student was present but hasn't submitted feedback
    const { data: attendedSessions } = await supabaseAdmin
      .from('attendance_records')
      .select('session_id')
      .eq('student_id', req.user.id)
      .eq('status', 'present');

    const attendedSessionIds = (attendedSessions || []).map(a => a.session_id);

    if (attendedSessionIds.length === 0) {
      return NextResponse.json({ pending: null, message: 'No sessions attended' });
    }

    // Get sessions where feedback was already submitted
    const { data: submittedFeedback } = await supabaseAdmin
      .from('feedback_responses')
      .select('session_id')
      .eq('student_id', req.user.id);

    const submittedSessionIds = [...new Set((submittedFeedback || []).map(f => f.session_id))];

    // Find pending sessions
    const pendingSessionIds = attendedSessionIds.filter(id => !submittedSessionIds.includes(id));

    if (pendingSessionIds.length === 0) {
      return NextResponse.json({ pending: null, message: 'All feedback submitted' });
    }

    // Get the most recent pending session
    const { data: session } = await supabaseAdmin
      .from('sessions')
      .select(`
        id, title, session_date, start_time, end_time,
        courses ( id, name ),
        faculty ( id, users ( first_name, last_name ) ),
        venues ( id, name )
      `)
      .in('id', pendingSessionIds)
      .order('session_date', { ascending: false })
      .limit(1)
      .single();

    // Get active feedback questions
    const { data: questions } = await supabaseAdmin
      .from('feedback_questions')
      .select('id, question, category, type, active')
      .eq('active', true)
      .order('created_at', { ascending: true });

    // Get student's feedback stats
    const totalSubmitted = submittedSessionIds.length;
    const totalPending = pendingSessionIds.length;

    return NextResponse.json({
      pending: session || null,
      questions: questions || [],
      stats: {
        totalSubmitted,
        totalPending,
        totalAttended: attendedSessionIds.length,
      },
    });
  } catch (err) {
    console.error('Feedback pending error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
