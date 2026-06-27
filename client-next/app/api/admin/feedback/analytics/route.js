export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';
import { getAttendedCountBySession } from '@/lib/feedback-eligibility';

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

      // Get attended count for this session (eligible students)
      const attendedCountMap = await getAttendedCountBySession(supabaseAdmin, [sessionId]);
      const attended = attendedCountMap[sessionId] || 0;

      // Get all feedback responses for this session (plain, no joins)
      const { data: responses } = await supabaseAdmin
        .from('feedback_responses')
        .select('student_id, question_id, rating, yes_no, text_answer, submitted_at')
        .eq('session_id', sessionId);

      // Get all questions for lookup
      const questionIds = [...new Set((responses || []).map(r => r.question_id))];
      const { data: questions } = questionIds.length > 0
        ? await supabaseAdmin.from('feedback_questions').select('id, question, type, category').in('id', questionIds)
        : { data: [] };
      const qMap = {};
      (questions || []).forEach(q => { qMap[q.id] = q; });

      // Get student details for lookup
      const studentIds = [...new Set((responses || []).map(r => r.student_id))];
      const { data: students } = studentIds.length > 0
        ? await supabaseAdmin.from('students').select('user_id, enrollment_no, users:user_id ( first_name, last_name )').in('user_id', studentIds)
        : { data: [] };
      const sMap = {};
      (students || []).forEach(s => { sMap[s.user_id] = s; });

      // ===== Per-question analytics =====
      const questionMap = {};
      (responses || []).forEach(r => {
        const q = qMap[r.question_id];
        if (!q) return;
        if (!questionMap[q.id]) {
          questionMap[q.id] = {
            id: q.id,
            question: q.question,
            type: q.type,
            category: q.category,
            responses: [],
          };
        }
        questionMap[q.id].responses.push(r);
      });

      const questionAnalytics = Object.values(questionMap).map(q => {
        const total = q.responses.length;
        if (q.type === 'yes_no') {
          const yesCount = q.responses.filter(r => r.yes_no === true).length;
          const noCount = q.responses.filter(r => r.yes_no === false).length;
          return {
            ...q, responses: undefined, total,
            yesCount, noCount,
            yesPct: total > 0 ? Math.round((yesCount / total) * 100) : 0,
            noPct: total > 0 ? Math.round((noCount / total) * 100) : 0,
          };
        } else if (q.type === 'rating') {
          const ratings = q.responses.filter(r => r.rating != null).map(r => r.rating);
          const avg = ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : 0;
          const dist = [5,4,3,2,1].map(v => ({
            value: v,
            count: ratings.filter(r => r === v).length,
            pct: ratings.length > 0 ? Math.round((ratings.filter(r => r === v).length / ratings.length) * 100) : 0,
          }));
          return { ...q, responses: undefined, total, avgRating: avg, distribution: dist };
        } else if (q.type === 'mcq') {
          const answers = q.responses.map(r => r.text_answer).filter(Boolean);
          const counts = {};
          answers.forEach(a => { counts[a] = (counts[a] || 0) + 1; });
          const dist = Object.entries(counts).map(([value, count]) => ({
            value, count, pct: total > 0 ? Math.round((count / total) * 100) : 0,
          })).sort((a, b) => b.count - a.count);
          return { ...q, responses: undefined, total, distribution: dist };
        } else {
          // text
          const texts = q.responses.filter(r => r.text_answer).map(r => ({
            text: r.text_answer,
            student: sMap[r.student_id]?.enrollment_no || r.student_id?.slice(0, 8),
          }));
          return { ...q, responses: undefined, total, textResponses: texts };
        }
      });

      // ===== Overall rating distribution (from rating columns) =====
      const allRatings = (responses || []).filter(r => r.rating != null).map(r => r.rating);
      const ratingDist = [5, 4, 3, 2, 1].map(r => ({
        rating: r,
        count: allRatings.filter(rating => rating === r).length,
      }));
      const totalRatings = allRatings.length;
      const ratingDistWithPct = ratingDist.map(r => ({
        ...r,
        pct: totalRatings > 0 ? Math.round((r.count / totalRatings) * 100) : 0,
      }));

      const avgRating = allRatings.length > 0
        ? Math.round((allRatings.reduce((a, b) => a + b, 0) / allRatings.length) * 10) / 10
        : 0;

      const studentRatingMap = {};
      (responses || []).forEach((r) => {
        if (r.rating != null && studentRatingMap[r.student_id] == null) {
          studentRatingMap[r.student_id] = r.rating;
        }
      });

      const descriptive = (responses || [])
        .filter((r) => r.text_answer && qMap[r.question_id]?.type === 'text')
        .map((r) => ({
          student: sMap[r.student_id]?.enrollment_no || r.student_id?.slice(0, 8),
          rating: studentRatingMap[r.student_id] ?? null,
          text: r.text_answer,
        }));

      // Unique students who submitted (for student-wise dropdown)
      const studentMap2 = {};
      (responses || []).forEach(r => {
        if (!studentMap2[r.student_id]) {
          const s = sMap[r.student_id];
          const name = s?.users
            ? `${s.users.first_name} ${s.users.last_name}`
            : s?.enrollment_no || 'Unknown';
          studentMap2[r.student_id] = {
            id: r.student_id,
            name,
            enrollmentNo: s?.enrollment_no || '',
          };
        }
      });
      const submittedStudents = Object.values(studentMap2);

      return NextResponse.json({
        session: {
          ...session,
          faculty_name: session.faculty?.users
            ? `${session.faculty.users.first_name} ${session.faculty.users.last_name}`
            : 'TBA',
        },
        avgRating,
        ratingDistribution: ratingDistWithPct,
        questionAnalytics,
        descriptive,
        submittedStudents,
        totalResponses: submittedStudents.length,
        totalEnrolled: attended,
        totalAttended: attended,
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

    const sessionIds = (sessions || []).map((s) => s.id);

    const { data: allResponses } =
      sessionIds.length > 0
        ? await supabaseAdmin
            .from('feedback_responses')
            .select('student_id, session_id, rating, yes_no, text_answer, submitted_at, question_id')
            .in('session_id', sessionIds)
        : { data: [] };

    const attendedCountMap = await getAttendedCountBySession(
      supabaseAdmin,
      sessionIds.length > 0 ? sessionIds : null
    );

    const responsesBySession = {};
    (allResponses || []).forEach((r) => {
      if (!responsesBySession[r.session_id]) responsesBySession[r.session_id] = [];
      responsesBySession[r.session_id].push(r);
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

    // Total expected submissions (sum of attended students per completed session)
    let totalExpected = 0;
    (sessions || []).forEach((s) => {
      totalExpected += attendedCountMap[s.id] || 0;
    });

    // Submission rate
    const onTimeRate = totalExpected > 0 ? Math.round((totalSubmissions / totalExpected) * 100) : 0;

    // Per-lecture breakdown
    const lectures = (sessions || []).map((s) => {
      const sessionResponses = responsesBySession[s.id] || [];
      const sessionRatings = sessionResponses.filter((r) => r.rating != null).map((r) => r.rating);
      const sessionDesc = sessionResponses.filter((r) => r.text_answer).length;
      const uniqueStudents = new Set(sessionResponses.map((r) => r.student_id)).size;
      const attended = attendedCountMap[s.id] || 0;

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
        totalEnrolled: attended,
        totalAttended: attended,
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
