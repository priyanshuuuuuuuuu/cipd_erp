export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';

async function handler(req) {
  try {
    const studentId = req.user.id;

    // 1. Get sessions where student attended (present or partial)
    const { data: attendedSessions } = await supabaseAdmin
      .from('attendance_records')
      .select('session_id')
      .eq('student_id', studentId)
      .in('status', ['present', 'partial']);

    const attendedSessionIds = (attendedSessions || []).map(a => a.session_id);

    if (attendedSessionIds.length === 0) {
      return NextResponse.json({ forms: [], questions: [], stats: { totalSubmitted: 0, totalPending: 0 } });
    }

    // 2. Get sessions where feedback already submitted
    const { data: submittedFeedback } = await supabaseAdmin
      .from('feedback_responses')
      .select('session_id')
      .eq('student_id', studentId);

    const submittedSessionIds = [...new Set((submittedFeedback || []).map(f => f.session_id))];

    // 3. Find pending session IDs
    const pendingSessionIds = attendedSessionIds.filter(id => !submittedSessionIds.includes(id));

    // 4. Get ALL pending sessions with details
    let pendingForms = [];
    if (pendingSessionIds.length > 0) {
      const { data: sessions } = await supabaseAdmin
        .from('sessions')
        .select(`
          id, title, session_date, start_time, end_time, feedback_deadline,
          courses ( id, name ),
          faculty ( id, users ( first_name, last_name ) ),
          venues ( id, name )
        `)
        .in('id', pendingSessionIds)
        .order('session_date', { ascending: false });

      pendingForms = (sessions || []).map(s => {
        // Deadline = feedback_deadline override OR session end_time + 24 hours
        let deadline;
        if (s.feedback_deadline) {
          deadline = new Date(s.feedback_deadline);
        } else {
          deadline = new Date(`${s.session_date}T${s.end_time || '23:59:00'}+05:30`);
          deadline.setHours(deadline.getHours() + 24);
        }
        const now = new Date();
        const expired = now > deadline;
        const hoursLeft = Math.max(0, Math.round((deadline - now) / 3600000 * 10) / 10);

        return {
          session_id: s.id,
          title: s.title,
          session_date: s.session_date,
          start_time: s.start_time,
          end_time: s.end_time,
          course: s.courses,
          faculty: s.faculty,
          venue: s.venues,
          deadline: deadline.toISOString(),
          expired,
          hoursLeft,
          submitted: false,
        };
      });
    }

    // 5. Get submitted sessions (for history)
    let submittedForms = [];
    if (submittedSessionIds.length > 0) {
      const { data: sessions } = await supabaseAdmin
        .from('sessions')
        .select(`
          id, title, session_date, start_time, end_time,
          courses ( id, name ),
          faculty ( id, users ( first_name, last_name ) )
        `)
        .in('id', submittedSessionIds)
        .order('session_date', { ascending: false })
        .limit(10);

      submittedForms = (sessions || []).map(s => ({
        session_id: s.id,
        title: s.title,
        session_date: s.session_date,
        course: s.courses,
        faculty: s.faculty,
        submitted: true,
      }));
    }

    // 6. Get active feedback questions (grouped by category)
    const { data: questions } = await supabaseAdmin
      .from('feedback_questions')
      .select('id, question, category, type, active')
      .eq('active', true)
      .order('created_at', { ascending: true });

    const activePending = pendingForms.filter(f => !f.expired).length;
    const expiredCount = pendingForms.filter(f => f.expired).length;

    return NextResponse.json({
      forms: [...pendingForms, ...submittedForms],
      questions: questions || [],
      stats: {
        totalSubmitted: submittedSessionIds.length,
        totalPending: activePending,
        totalExpired: expiredCount,
        totalAttended: attendedSessionIds.length,
      },
    });
  } catch (err) {
    console.error('Feedback pending error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
