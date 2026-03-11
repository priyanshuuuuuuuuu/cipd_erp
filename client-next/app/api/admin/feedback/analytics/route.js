export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

async function getHandler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');

    // ===== DETAIL VIEW for a specific session =====
    if (sessionId) {
      const { data: session } = await supabaseAdmin
        .from('sessions')
        .select(`
          id, title, session_date, course_id,
          courses ( name ),
          faculty ( id, users ( first_name, last_name ) )
        `)
        .eq('id', sessionId)
        .single();

      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      // Get enrolled count for this course
      const { count: enrolled } = await supabaseAdmin
        .from('course_enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', session.course_id);

      // Get all feedback responses for this session
      const { data: responses } = await supabaseAdmin
        .from('feedback_responses')
        .select(`
          student_id, rating, yes_no, text_answer, submitted_at,
          feedback_questions:question_id ( question, type ),
          students:student_id ( enrollment_no )
        `)
        .eq('session_id', sessionId);

      // Rating distribution from rating column
      const ratings = (responses || []).filter(r => r.rating != null).map(r => r.rating);
      const ratingDist = [5, 4, 3, 2, 1].map(r => ({
        rating: r,
        count: ratings.filter(rating => rating === r).length,
      }));
      const totalRatings = ratings.length;
      const ratingDistWithPct = ratingDist.map(r => ({
        ...r,
        pct: totalRatings > 0 ? Math.round((r.count / totalRatings) * 100) : 0,
      }));

      // Average rating
      const avgRating = ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : 0;

      // Descriptive responses (text_answer column)
      const descriptive = (responses || [])
        .filter(r => r.text_answer)
        .map(r => ({
          student: r.students?.enrollment_no || r.student_id?.slice(0, 8),
          rating: (responses || []).find(
            rr => rr.student_id === r.student_id && rr.rating != null
          )?.rating || null,
          text: r.text_answer,
        }));

      // Unique students who submitted
      const uniqueStudents = new Set((responses || []).map(r => r.student_id)).size;

      return NextResponse.json({
        session: {
          ...session,
          faculty_name: session.faculty?.users
            ? `${session.faculty.users.first_name} ${session.faculty.users.last_name}`
            : 'TBA',
        },
        avgRating,
        ratingDistribution: ratingDistWithPct,
        descriptive,
        totalResponses: uniqueStudents,
        totalEnrolled: enrolled || 0,
      });
    }

    // ===== OVERVIEW — summary across all completed sessions =====

    // Get all completed sessions with their course and faculty info
    const { data: sessions } = await supabaseAdmin
      .from('sessions')
      .select(`
        id, title, session_date, course_id,
        courses ( name ),
        faculty ( id, users ( first_name, last_name ) )
      `)
      .eq('status', 'completed')
      .order('session_date', { ascending: false });

    // Get all feedback responses with columns: rating, yes_no, text_answer
    const { data: allResponses } = await supabaseAdmin
      .from('feedback_responses')
      .select('student_id, session_id, rating, yes_no, text_answer, submitted_at, question_id');

    // Get all enrollments for quick lookup
    const { data: enrollments } = await supabaseAdmin
      .from('course_enrollments')
      .select('course_id, student_id');

    // Build enrollment count map per course
    const enrollmentMap = {};
    (enrollments || []).forEach(e => {
      enrollmentMap[e.course_id] = (enrollmentMap[e.course_id] || 0) + 1;
    });

    // Extract ratings from the rating column
    const ratings = (allResponses || []).filter(r => r.rating != null).map(r => r.rating);
    const avgRating = ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : 0;

    // Count text_answer responses
    const totalDescriptive = (allResponses || []).filter(r => r.text_answer).length;

    // Rating distribution
    const ratingDist = [5, 4, 3, 2, 1].map(r => ({
      rating: r,
      count: ratings.filter(rating => rating === r).length,
    }));
    const totalRatings = ratings.length;
    const ratingDistWithPct = ratingDist.map(r => ({
      ...r,
      pct: totalRatings > 0 ? Math.round((r.count / totalRatings) * 100) : 0,
    }));

    // Total unique (session, student) pairs = total submissions
    const submissionPairs = new Set(
      (allResponses || []).map(r => `${r.session_id}::${r.student_id}`)
    );
    const totalSubmissions = submissionPairs.size;

    // Total expected submissions (sum of enrollments for each completed session's course)
    let totalExpected = 0;
    (sessions || []).forEach(s => {
      totalExpected += enrollmentMap[s.course_id] || 0;
    });

    // Submission rate
    const onTimeRate = totalExpected > 0 ? Math.round((totalSubmissions / totalExpected) * 100) : 0;

    // Per-lecture breakdown
    const lectures = (sessions || []).map(s => {
      const sessionResponses = (allResponses || []).filter(r => r.session_id === s.id);
      const sessionRatings = sessionResponses.filter(r => r.rating != null).map(r => r.rating);
      const sessionDesc = sessionResponses.filter(r => r.text_answer).length;
      const uniqueStudents = new Set(sessionResponses.map(r => r.student_id)).size;
      const enrolled = enrollmentMap[s.course_id] || 0;

      return {
        id: s.id,
        lecture: `${s.courses?.name || ''} – ${s.title}`,
        date: s.session_date,
        faculty: s.faculty?.users
          ? `${s.faculty.users.first_name} ${s.faculty.users.last_name}`
          : 'TBA',
        avg: sessionRatings.length > 0
          ? Math.round((sessionRatings.reduce((a, b) => a + b, 0) / sessionRatings.length) * 10) / 10
          : 0,
        submissions: uniqueStudents,
        totalEnrolled: enrolled,
        descCount: sessionDesc,
        topic: s.title,
      };
    });

    // Trend data — last 7 completed sessions that have feedback
    const lecturesWithFeedback = lectures.filter(l => l.submissions > 0);
    const trendLectures = lecturesWithFeedback.slice(0, 7).reverse();
    const trendData = trendLectures.map((l, i) => ({
      l: `L${i + 1}`,
      label: l.lecture.split(' – ')[1] || l.lecture,
      avg: l.avg,
      sub: l.totalEnrolled > 0 ? Math.round((l.submissions / l.totalEnrolled) * 100) : 0,
    }));

    return NextResponse.json({
      summary: {
        totalLectures: (sessions || []).length,
        avgRating,
        onTimeRate,
        descriptiveCount: totalDescriptive,
        totalSubmissions,
        totalEnrolled: totalExpected,
      },
      ratingDistribution: ratingDistWithPct,
      lectures,
      trendData,
    });
  } catch (err) {
    console.error('Admin feedback analytics error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(getHandler, ['admin']);
