export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  sessions,
  courses,
  faculty,
  users,
  venues,
  sessionTypes,
  sessionSkills,
  courseEnrollments,
} from '@/drizzle/schema';
import { eq, gte, lte, inArray, and, asc, sql } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';
import { getISTDateString, getISTWeekRange } from '@/lib/ist-date';

async function handler(request) {
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get('filter') || 'all';

  try {
    const conditions = [];
    const todayStr = getISTDateString();

    if (filter === 'today') {
      conditions.push(eq(sessions.sessionDate, todayStr));
    } else if (filter === 'week') {
      const { start: monday, end: sunday } = getISTWeekRange();
      conditions.push(gte(sessions.sessionDate, monday));
      conditions.push(lte(sessions.sessionDate, sunday));
    } else if (filter === 'window') {
      const days = parseInt(searchParams.get('days') || '2', 10);
      const now = new Date();
      const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
      const nowIstMs = now.getTime() + IST_OFFSET_MS;
      const startIstStr = new Date(nowIstMs - days * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const endIstStr = new Date(nowIstMs + days * 24 * 3600 * 1000).toISOString().slice(0, 10);

      conditions.push(gte(sessions.sessionDate, startIstStr));
      conditions.push(lte(sessions.sessionDate, endIstStr));
    } else if (['scheduled', 'pending', 'cancelled'].includes(filter)) {
      conditions.push(eq(sessions.status, filter));
    }

    const rows = await db
      .select({
        id: sessions.id,
        title: sessions.title,
        session_date: sessions.sessionDate,
        start_time: sessions.startTime,
        end_time: sessions.endTime,
        feedback_deadline: sessions.feedbackDeadline,
        status: sessions.status,
        course_id: sessions.courseId,
        faculty_id: sessions.facultyId,
        venue_id: sessions.venueId,
        session_type_id: sessions.sessionTypeId,
        course_name: courses.name,
        first_name: users.firstName,
        last_name: users.lastName,
        venue_name: venues.name,
        session_type_name: sessionTypes.name,
      })
      .from(sessions)
      .leftJoin(courses, eq(sessions.courseId, courses.id))
      .leftJoin(faculty, eq(sessions.facultyId, faculty.id))
      .leftJoin(users, eq(faculty.id, users.id))
      .leftJoin(venues, eq(sessions.venueId, venues.id))
      .leftJoin(sessionTypes, eq(sessions.sessionTypeId, sessionTypes.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(sessions.sessionDate), asc(sessions.startTime));

    const sessionIds = (rows || []).map(s => s.id);
    const skillsMap = {};

    if (sessionIds.length > 0) {
      try {
        const ssData = await db
          .select({
            session_id: sessionSkills.sessionId,
            skill_id: sessionSkills.skillId,
          })
          .from(sessionSkills)
          .where(inArray(sessionSkills.sessionId, sessionIds));

        (ssData || []).forEach(row => {
          if (!skillsMap[row.session_id]) skillsMap[row.session_id] = [];
          skillsMap[row.session_id].push(row.skill_id);
        });
      } catch (_) {}
    }

    const deliveryMap = {};
    if (sessionIds.length > 0) {
      try {
        const messages = await db.execute(
          sql`SELECT session_id, status FROM notification_stream WHERE session_id IN ${sessionIds}`
        );
        (messages || []).forEach(message => {
          if (!message.session_id) return;
          if (!deliveryMap[message.session_id]) {
            deliveryMap[message.session_id] = {
              total: 0, queued: 0, processing: 0, retry: 0,
              sent: 0, failed: 0, state: 'not_sent',
            };
          }
          const delivery = deliveryMap[message.session_id];
          delivery.total += 1;
          if (Object.prototype.hasOwnProperty.call(delivery, message.status)) {
            delivery[message.status] += 1;
          }
        });

        Object.values(deliveryMap).forEach(delivery => {
          const outstanding = delivery.queued + delivery.processing + delivery.retry;
          delivery.state = outstanding > 0
            ? 'sending'
            : delivery.failed > 0
              ? 'failed'
              : delivery.sent > 0 ? 'sent' : 'not_sent';
        });
      } catch (streamError) {
        // Table or query unavailable
      }
    }

    const courseIds = [...new Set((rows || []).map(s => s.course_id).filter(Boolean))];
    const enrollmentMap = {};

    if (courseIds.length > 0) {
      const enrollments = await db
        .select({ course_id: courseEnrollments.courseId })
        .from(courseEnrollments)
        .where(inArray(courseEnrollments.courseId, courseIds));

      (enrollments || []).forEach(e => {
        if (!e.course_id) return;
        enrollmentMap[e.course_id] = (enrollmentMap[e.course_id] || 0) + 1;
      });
    }

    const nowUtcMs = Date.now();
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const nowIstMs = nowUtcMs + IST_OFFSET_MS;
    const nowIst = new Date(nowIstMs);
    const nowIstStr = nowIst.toISOString().slice(0, 16);

    const sessionList = (rows || []).map(s => {
      let computedStatus = s.status === 'scheduled'
        ? 'Scheduled'
        : s.status.charAt(0).toUpperCase() + s.status.slice(1);

      let _shouldMarkCompleted = false;
      if (s.status === 'scheduled' && s.session_date && s.start_time && s.end_time) {
        const sessionStartStr = `${s.session_date}T${s.start_time.slice(0, 5)}`;
        const sessionEndStr   = `${s.session_date}T${s.end_time.slice(0, 5)}`;

        if (nowIstStr >= sessionEndStr) {
          computedStatus = 'Completed';
          _shouldMarkCompleted = true;
        } else if (nowIstStr >= sessionStartStr) {
          computedStatus = 'Ongoing';
        }
      }

      const facultyName = s.first_name || s.last_name
        ? `Prof. ${s.first_name || ''} ${s.last_name || ''}`.trim()
        : 'Unknown';

      return {
        id: s.id,
        _shouldMarkCompleted,
        course: s.course_name || 'Unknown',
        sessionType: s.session_type_name || null,
        faculty: facultyName,
        venue: s.venue_name || 'TBA',
        date: s.session_date,
        time: s.start_time?.slice(0, 5),
        endTime: s.end_time?.slice(0, 5),
        feedback_deadline: s.feedback_deadline || null,
        feedback_delivery: deliveryMap[s.id] || {
          total: 0, queued: 0, processing: 0, retry: 0,
          sent: 0, failed: 0, state: 'not_sent',
        },
        students: enrollmentMap[s.course_id] || 0,
        status: computedStatus,
        title: s.title || '',
        course_id: s.course_id || '',
        faculty_id: s.faculty_id || '',
        venue_id: s.venue_id || '',
        session_type_id: s.session_type_id || '',
        skill_ids: skillsMap[s.id] || [],
      };
    });

    const toComplete = sessionList.filter(s => s._shouldMarkCompleted).map(s => s.id);
    if (toComplete.length > 0) {
      db.update(sessions)
        .set({ status: 'completed' })
        .where(and(inArray(sessions.id, toComplete), eq(sessions.status, 'scheduled')))
        .catch(err => console.error('Auto-complete sessions write-back error:', err));
    }

    const clientSessions = sessionList.map(({ _shouldMarkCompleted, ...rest }) => rest);

    return NextResponse.json({ sessions: clientSessions });

  } catch (error) {
    console.error('Schedule API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const GET = withRole(handler, ['admin']);
