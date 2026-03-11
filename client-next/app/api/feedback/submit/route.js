export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';

async function handler(req) {
  try {
    const { session_id, responses } = await req.json();

    if (!session_id || !responses || !Array.isArray(responses)) {
      return NextResponse.json({ error: 'session_id and responses array are required' }, { status: 400 });
    }

    // Build feedback records
    const records = responses.map(r => ({
      session_id,
      student_id: req.user.id,
      question_id: r.question_id,
      rating: r.rating || null,
      yes_no: r.yes_no !== undefined ? r.yes_no : null,
      text_answer: r.text_answer || null,
    }));

    const { error } = await supabaseAdmin
      .from('feedback_responses')
      .insert(records);

    if (error) {
      console.error('Feedback submit error:', error);
      return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Feedback submitted successfully' });
  } catch (err) {
    console.error('Feedback submit error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withAuth(handler);
