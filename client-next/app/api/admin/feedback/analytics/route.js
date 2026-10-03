export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessions, feedbackResponses, feedbackQuestions, students, courses, faculty, users } from '@/drizzle/schema';
import { eq, inArray, or, desc, asc, and, isNotNull } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';
import { getAttendedCountBySession } from '@/lib/feedback-eligibility';

async function getHandler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');

    // ===== DETAIL VIEW for a specific session =====
    if (sessionId) {
      const session = await db.query.sessions.findFirst({
        columns: { id: true, title: true, sessionDate: true, courseId: true },
        where: eq(sessions.id, sessionId),
        with: {
          course: { columns: { name: true } },
          faculty: { columns: { id: true }, with: { user: { columns: { firstName: true, lastName: true } } } }
        }
      });

      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      // Get attended count for this session (eligible students)
      const attendedCountMap = await getAttendedCountBySession(db, [sessionId]);
      const attended = attendedCountMap[sessionId] || 0;

      // Get all feedback responses for this session (plain, no joins)
      const responses = await db.query.feedbackResponses.findMany({
        columns: { studentId: true, questionId: true, rating: true, yesNo: true, textAnswer: true, submittedAt: true },
        where: eq(feedbackResponses.sessionId, sessionId)
      });

      // Get all questions for lookup
      const questionIds = [...new Set((responses || []).map(r => r.questionId).filter(Boolean))];
      let questionsData = [];
      if (questionIds.length > 0) {
        questionsData = await db.query.feedbackQuestions.findMany({
          columns: { id: true, question: true, type: true, category: true },
          where: inArray(feedbackQuestions.id, questionIds)
        });
      }
      const qMap = {};
      (questionsData || []).forEach(q => { qMap[q.id] = q; });

      // Get student details for lookup
      const studentIds = [...new Set((responses || []).map(r => r.studentId).filter(Boolean))];
      let studentsData = [];
      if (studentIds.length > 0) {
        studentsData = await db.query.students.findMany({
          columns: { id: true, enrollmentNo: true },
          where: inArray(students.id, studentIds),
          with: { user: { columns: { firstName: true, lastName: true } } }
        });
      }
      const sMap = {};
      (studentsData || []).forEach(s => { sMap[s.id] = s; });

      // ===== Per-question analytics =====
      const questionMap = {};
      (responses || []).forEach(r => {
        const q = qMap[r.questionId];
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
          const yesCount = q.responses.filter(r => r.yesNo === true).length;
          const noCount = q.responses.filter(r => r.yesNo === false).length;
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
          const answers = q.responses.map(r => r.textAnswer).filter(Boolean);
          const counts = {};
          answers.forEach(a => { counts[a] = (counts[a] || 0) + 1; });
          const dist = Object.entries(counts).map(([value, count]) => ({
            value, count, pct: total > 0 ? Math.round((count / total) * 100) : 0,
          })).sort((a, b) => b.count - a.count);
          return { ...q, responses: undefined, total, distribution: dist };
        } else {
          // text
          const texts = q.responses.filter(r => r.textAnswer).map(r => ({
            text: r.textAnswer,
            student: sMap[r.studentId]?.enrollmentNo || r.studentId?.slice(0, 8),
          }));
          return { ...q, responses: undefined, total, textResponses: texts };
        }
      });

      // ===== Overall rating distribution =====
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
        if (r.rating != null && studentRatingMap[r.studentId] == null) {
          studentRatingMap[r.studentId] = r.rating;
        }
      });

      const descriptive = (responses || [])
        .filter((r) => r.textAnswer && qMap[r.questionId]?.type === 'text')
        .map((r) => ({
          student: sMap[r.studentId]?.enrollmentNo || r.studentId?.slice(0, 8),
          rating: studentRatingMap[r.studentId] ?? null,
          text: r.textAnswer,
        }));

      // Unique students who submitted
      const studentMap2 = {};
      (responses || []).forEach(r => {
        if (!studentMap2[r.studentId]) {
          const s = sMap[r.studentId];
          const name = s?.user
            ? `${s.user.firstName} ${s.user.lastName}`
            : s?.enrollmentNo || 'Unknown';
          studentMap2[r.studentId] = {
            id: r.studentId,
            name,
            enrollmentNo: s?.enrollmentNo || '',
          };
        }
      });
      const submittedStudents = Object.values(studentMap2);

      const formattedSession = {
        id: session.id,
        title: session.title,
        session_date: session.sessionDate,
        course_id: session.courseId,
        courses: { name: session.course?.name },
        faculty: session.faculty ? {
            id: session.faculty.id,
            users: { first_name: session.faculty.user?.firstName, last_name: session.faculty.user?.lastName }
        } : null,
        faculty_name: session.faculty?.user
            ? `${session.faculty.user.firstName} ${session.faculty.user.lastName}`
            : 'TBA',
      };

      return NextResponse.json({
        session: formattedSession,
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

    // ===== OVERVIEW =====

    const responseSessionRows = await db.query.feedbackResponses.findMany({
      columns: { sessionId: true }
    });
    const responseSessionIds = [...new Set((responseSessionRows || []).map((row) => row.sessionId).filter(Boolean))];
    
    let whereClause = eq(sessions.status, 'completed');
    if (responseSessionIds.length > 0) {
      whereClause = or(eq(sessions.status, 'completed'), inArray(sessions.id, responseSessionIds));
    }

    const sessionsData = await db.query.sessions.findMany({
      columns: { id: true, title: true, sessionDate: true, courseId: true },
      where: whereClause,
      with: {
        course: { columns: { name: true } },
        faculty: { columns: { id: true }, with: { user: { columns: { firstName: true, lastName: true } } } }
      },
      orderBy: [desc(sessions.sessionDate)]
    });

    const sessionIds = (sessionsData || []).map((s) => s.id);

    let allResponses = [];
    if (sessionIds.length > 0) {
        allResponses = await db.query.feedbackResponses.findMany({
            columns: { studentId: true, sessionId: true, rating: true, yesNo: true, textAnswer: true, submittedAt: true, questionId: true },
            where: inArray(feedbackResponses.sessionId, sessionIds)
        });
    }

    const attendedCountMap = await getAttendedCountBySession(
      db,
      sessionIds.length > 0 ? sessionIds : null
    );

    const responsesBySession = {};
    (allResponses || []).forEach((r) => {
      if (!responsesBySession[r.sessionId]) responsesBySession[r.sessionId] = [];
      responsesBySession[r.sessionId].push(r);
    });

    const ratings = (allResponses || []).filter(r => r.rating != null).map(r => r.rating);
    const avgRating = ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : 0;

    const totalDescriptive = (allResponses || []).filter(r => r.textAnswer).length;

    const ratingDist = [5, 4, 3, 2, 1].map(r => ({
      rating: r,
      count: ratings.filter(rating => rating === r).length,
    }));
    const totalRatings = ratings.length;
    const ratingDistWithPct = ratingDist.map(r => ({
      ...r,
      pct: totalRatings > 0 ? Math.round((r.count / totalRatings) * 100) : 0,
    }));

    const submissionPairs = new Set(
      (allResponses || []).map(r => `${r.sessionId}::${r.studentId}`)
    );
    const totalSubmissions = submissionPairs.size;

    let totalExpected = 0;
    (sessionsData || []).forEach((s) => {
      totalExpected += attendedCountMap[s.id] || 0;
    });

    const onTimeRate = totalExpected > 0 ? Math.round((totalSubmissions / totalExpected) * 100) : 0;

    const lectures = (sessionsData || []).map((s) => {
      const sessionResponses = responsesBySession[s.id] || [];
      const sessionRatings = sessionResponses.filter((r) => r.rating != null).map((r) => r.rating);
      const sessionDesc = sessionResponses.filter((r) => r.textAnswer).length;
      const uniqueStudents = new Set(sessionResponses.map((r) => r.studentId)).size;
      const attended = attendedCountMap[s.id] || 0;

      return {
        id: s.id,
        lecture: `${s.course?.name || ''} – ${s.title}`,
        date: s.sessionDate,
        faculty: s.faculty?.user
          ? `${s.faculty.user.firstName} ${s.faculty.user.lastName}`
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

    const lecturesWithFeedback = lectures.filter(l => l.submissions > 0);
    const trendLectures = lecturesWithFeedback.slice(0, 7).reverse();
    const trendData = trendLectures.map((l, i) => ({
      l: `L${i + 1}`,
      label: l.lecture.split(' – ')[1] || l.lecture,
      avg: l.avg,
      sub: l.totalEnrolled > 0 ? Math.round((l.submissions / l.totalEnrolled) * 100) : 0,
    }));

    const lectureById = new Map(lectures.map((lecture) => [lecture.id, lecture]));
    const latestSubmissionByPair = new Map();
    (allResponses || []).forEach((response) => {
      const key = `${response.sessionId}:${response.studentId}`;
      const previous = latestSubmissionByPair.get(key);
      if (!previous || new Date(response.submittedAt).getTime() > new Date(previous.submittedAt).getTime()) {
        latestSubmissionByPair.set(key, response);
      }
    });
    
    const recentSubmissions = [...latestSubmissionByPair.values()]
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
      .slice(0, 6)
      .map((response) => ({
        id: `${response.sessionId}:${response.studentId}`,
        session_id: response.sessionId,
        lecture: lectureById.get(response.sessionId)?.lecture || 'Feedback response',
        submitted_at: response.submittedAt,
      }));

    return NextResponse.json({
      summary: {
        totalLectures: (sessionsData || []).length,
        avgRating,
        onTimeRate,
        descriptiveCount: totalDescriptive,
        totalSubmissions,
        totalEnrolled: totalExpected,
      },
      ratingDistribution: ratingDistWithPct,
      lectures,
      trendData,
      recentSubmissions,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Admin feedback analytics error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(getHandler, ['admin']);
