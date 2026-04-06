export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

async function getHandler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');
    const studentId = searchParams.get('student_id');

    if (!sessionId || !studentId) {
      return NextResponse.json({ error: 'session_id and student_id required' }, { status: 400 });
    }

    // Get all responses for this student + session, with question details
    const { data: responses } = await supabaseAdmin
      .from('feedback_responses')
      .select(`
        question_id, rating, yes_no, text_answer, submitted_at,
        feedback_questions:question_id ( id, question, type, category )
      `)
      .eq('session_id', sessionId)
      .eq('student_id', studentId)
      .order('question_id');

    // Get student info
    const { data: student } = await supabaseAdmin
      .from('students')
      .select('enrollment_no, users:user_id ( first_name, last_name )')
      .eq('user_id', studentId)
      .single();

    const formattedResponses = (responses || []).map(r => ({
      question: r.feedback_questions?.question,
      type: r.feedback_questions?.type,
      category: r.feedback_questions?.category,
      answer: r.feedback_questions?.type === 'yes_no' ? (r.yes_no ? 'Yes' : 'No')
        : r.feedback_questions?.type === 'rating' ? `${r.rating}/5`
        : r.feedback_questions?.type === 'mcq' ? (r.text_answer || '—')
        : (r.text_answer || '—'),
      raw: { rating: r.rating, yes_no: r.yes_no, text_answer: r.text_answer },
      submitted_at: r.submitted_at,
    }));

    return NextResponse.json({
      student: {
        name: student?.users ? `${student.users.first_name} ${student.users.last_name}` : 'Unknown',
        enrollmentNo: student?.enrollment_no || '',
      },
      responses: formattedResponses,
    });
  } catch (err) {
    console.error('Student response error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(getHandler, ['admin']);
