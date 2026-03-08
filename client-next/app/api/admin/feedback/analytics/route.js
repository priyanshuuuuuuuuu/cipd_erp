import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

async function getHandler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');

    // Get feedback analytics — overview or detail
    if (sessionId) {
      // Detail view for a specific session
      const { data: session } = await supabaseAdmin
        .from('sessions')
        .select(`
          id, title, session_date,
          courses ( name ),
          faculty ( id, users ( first_name, last_name ) )
        `)
        .eq('id', sessionId)
        .single();

      const { data: responses } = await supabaseAdmin
        .from('feedback_responses')
        .select(`
          student_id, rating, yes_no, text_answer, submitted_at,
          feedback_questions ( question, type ),
          students ( enrollment_no )
        `)
        .eq('session_id', sessionId);

      // Rating distribution
      const ratingDist = [1, 2, 3, 4, 5].map(r => ({
        rating: r,
        count: (responses || []).filter(resp => resp.rating === r).length,
      }));
      const totalRatings = ratingDist.reduce((a, d) => a + d.count, 0);
      const ratingDistWithPct = ratingDist.map(r => ({
        ...r,
        pct: totalRatings > 0 ? Math.round((r.count / totalRatings) * 100) : 0,
      }));

      // Average rating
      const ratingsOnly = (responses || []).filter(r => r.rating != null).map(r => r.rating);
      const avgRating = ratingsOnly.length > 0
        ? Math.round((ratingsOnly.reduce((a, b) => a + b, 0) / ratingsOnly.length) * 10) / 10
        : 0;

      // Descriptive responses
      const descriptive = (responses || [])
        .filter(r => r.text_answer)
        .map(r => ({
          student: r.students?.enrollment_no || r.student_id,
          rating: r.rating,
          text: r.text_answer,
        }));

      return NextResponse.json({
        session,
        avgRating,
        ratingDistribution: ratingDistWithPct,
        descriptive,
        totalResponses: (responses || []).length,
      });
    }

    // Overview — summary across all sessions
    const { data: allResponses } = await supabaseAdmin
      .from('feedback_responses')
      .select('rating, text_answer, session_id, submitted_at')
      .not('rating', 'is', null);

    const ratings = (allResponses || []).map(r => r.rating).filter(Boolean);
    const avgRating = ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : 0;

    const totalDescriptive = (allResponses || []).filter(r => r.text_answer).length;
    const uniqueSessions = new Set((allResponses || []).map(r => r.session_id)).size;

    // Rating distribution
    const ratingDist = [1, 2, 3, 4, 5].map(r => ({
      rating: r,
      count: ratings.filter(rating => rating === r).length,
    }));
    const totalRatings = ratingDist.reduce((a, d) => a + d.count, 0);
    const ratingDistWithPct = ratingDist.map(r => ({
      ...r,
      pct: totalRatings > 0 ? Math.round((r.count / totalRatings) * 100) : 0,
    }));

    // Per-lecture list
    const { data: sessions } = await supabaseAdmin
      .from('sessions')
      .select(`
        id, title, session_date,
        courses ( name ),
        faculty ( id, users ( first_name, last_name ) )
      `)
      .eq('status', 'completed')
      .order('session_date', { ascending: false })
      .limit(20);

    const lectures = (sessions || []).map(s => {
      const sessionResponses = (allResponses || []).filter(r => r.session_id === s.id);
      const sessionRatings = sessionResponses.map(r => r.rating).filter(Boolean);
      return {
        id: s.id,
        lecture: `${s.courses?.name || ''} – ${s.title}`,
        date: s.session_date,
        faculty: `${s.faculty?.users?.first_name || ''} ${s.faculty?.users?.last_name || ''}`.trim(),
        avg: sessionRatings.length > 0
          ? Math.round((sessionRatings.reduce((a, b) => a + b, 0) / sessionRatings.length) * 10) / 10
          : 0,
        submissions: sessionResponses.length,
        descCount: sessionResponses.filter(r => r.text_answer).length,
      };
    });

    return NextResponse.json({
      summary: {
        totalLectures: uniqueSessions,
        avgRating,
        totalSubmissions: (allResponses || []).length,
        descriptiveCount: totalDescriptive,
      },
      ratingDistribution: ratingDistWithPct,
      lectures,
    });
  } catch (err) {
    console.error('Admin feedback analytics error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(getHandler, ['admin']);
