export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';

/**
 * Returns all feedback forms available to the logged-in student.
 *
 * Source of truth: the `notifications` table (type = 'feedback_available').
 * If a student received a notification for a session → they see the form.
 * This decouples feedback visibility from WiFi attendance status.
 *
 * Fallback: also include sessions where student has present/partial
 * attendance records but no notification yet (edge-case catch).
 */
async function handler(req) {
  try {
    const studentId = req.user.id; // this is users.id

    // ── 1. Primary: sessions the student was explicitly notified for ──────────
    const { data: notifRows } = await supabaseAdmin
      .from('notifications')
      .select('session_id')
      .eq('recipient_id', studentId)
      .eq('type', 'feedback_available');

    const notifiedSessionIds = [...new Set((notifRows || []).map((n) => n.session_id).filter(Boolean))];

    // ── 2. Fallback: sessions with present/partial attendance (no notification) ─
    const { data: attendedRows } = await supabaseAdmin
      .from('attendance_records')
      .select('session_id')
      .eq('student_id', studentId)
      .in('status', ['present', 'partial']);

    const attendedSessionIds = [...new Set((attendedRows || []).map((a) => a.session_id))];

    // Union of both sources
    const allEligibleIds = [...new Set([...notifiedSessionIds, ...attendedSessionIds])];

    if (allEligibleIds.length === 0) {
      const { data: questions } = await supabaseAdmin
        .from('feedback_questions')
        .select('id, question, category, type, active')
        .eq('active', true)
        .order('created_at', { ascending: true });

      return NextResponse.json({
        forms: [],
        questions: questions || [],
        stats: { totalSubmitted: 0, totalPending: 0, totalExpired: 0, totalAttended: 0 },
      });
    }

    // ── 3. Sessions where feedback already submitted ────────────────────────────
    const { data: submittedRows } = await supabaseAdmin
      .from('feedback_responses')
      .select('session_id')
      .eq('student_id', studentId);

    const submittedSessionIds = [...new Set((submittedRows || []).map((f) => f.session_id))];

    // ── 4. Pending = eligible but not yet submitted ─────────────────────────────
    const pendingSessionIds = allEligibleIds.filter((id) => !submittedSessionIds.includes(id));

    // ── 5. Fetch session details for pending forms ─────────────────────────────
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

      pendingForms = (sessions || []).map((s) => {
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

    // ── 6. Fetch session details for submitted forms (history) ─────────────────
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

      submittedForms = (sessions || []).map((s) => ({
        session_id: s.id,
        title: s.title,
        session_date: s.session_date,
        course: s.courses,
        faculty: s.faculty,
        submitted: true,
      }));
    }

    // ── 7. Fetch active feedback questions ─────────────────────────────────────
    const { data: questions } = await supabaseAdmin
      .from('feedback_questions')
      .select('id, question, category, type, active')
      .eq('active', true)
      .order('created_at', { ascending: true });

    const activePending = pendingForms.filter((f) => !f.expired).length;
    const expiredCount  = pendingForms.filter((f) => f.expired).length;

    return NextResponse.json({
      forms: [...pendingForms, ...submittedForms],
      questions: questions || [],
      stats: {
        totalSubmitted: submittedSessionIds.length,
        totalPending:   activePending,
        totalExpired:   expiredCount,
        totalAttended:  allEligibleIds.length,
      },
    });
  } catch (err) {
    console.error('Feedback pending error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
