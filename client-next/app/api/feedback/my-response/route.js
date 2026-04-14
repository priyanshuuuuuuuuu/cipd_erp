export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';

/**
 * GET /api/feedback/my-response?session_id=<uuid>
 * Returns the logged-in student's submitted answers for a specific session.
 * Uses the same FK hint pattern as the admin student-response route.
 */
async function handler(req) {
  try {
    const studentId = req.user.id;
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }

    // Use explicit FK hint: feedback_questions:question_id — same as admin route
    const { data: responses, error } = await supabaseAdmin
      .from('feedback_responses')
      .select(`
        question_id, rating, yes_no, text_answer,
        feedback_questions:question_id ( id, question, type, category )
      `)
      .eq('student_id', studentId)
      .eq('session_id', sessionId)
      .order('question_id');

    if (error) {
      console.error('my-response fetch error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also fetch session info for display
    const { data: session } = await supabaseAdmin
      .from('sessions')
      .select('id, title, session_date, courses(name)')
      .eq('id', sessionId)
      .single();

    // Format identically to admin route so frontend can reuse the same pattern
    const formatted = (responses || []).map(r => ({
      id: r.question_id,
      rating: r.rating,
      yes_no: r.yes_no,
      text_answer: r.text_answer,
      feedback_questions: r.feedback_questions,
    }));

    return NextResponse.json({ responses: formatted, session });
  } catch (err) {
    console.error('my-response error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
