import { db, runWithSchema, getActiveSchema } from '@/lib/db';
import {
  sessions,
  courses,
  venues,
  faculty,
  users,
  students,
  attendanceRecords,
  attendancePingLogs,
  feedbackResponses,
  notifications,
} from '@/drizzle/schema';
import { eq, and, ne, inArray, asc } from 'drizzle-orm';
import { getISTDateString } from '@/lib/ist-date';
import { sendDailyStudentDigestEmail } from '@/lib/emailer';
import { fetchPreferencesMap, shouldNotifyUser } from '@/lib/should-notify';

/**
 * Format date string "YYYY-MM-DD" into IST human-readable date,
 * e.g., "Monday, 19 October 2026"
 */
export function formatISTDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return dt.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

/**
 * Format any time string or timestamp into IST 12-hour format, e.g. "09:30 AM"
 */
export function formatISTTime(val) {
  if (!val) return null;
  const str = String(val).trim();
  if (/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(str)) {
    return str.toUpperCase();
  }
  // Simple time string like "HH:MM" or "HH:MM:SS" (already in IST local time)
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(str)) {
    const parts = str.split(':');
    let hour = parseInt(parts[0], 10);
    const min = parts[1];
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${String(hour).padStart(2, '0')}:${min} ${ampm}`;
  }
  // Full timestamp (e.g. "2026-06-30 04:05:28.930" stored in UTC)
  try {
    const iso = !str.endsWith('Z') && !str.includes('+') ? str.replace(' ', 'T') + 'Z' : str;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return str;
    return d.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).toUpperCase();
  } catch {
    return str;
  }
}

/**
 * Parses a timestamp into epoch milliseconds for comparisons.
 */
function toEpochMs(val) {
  if (!val) return null;
  try {
    const str = String(val).trim();
    const iso = !str.endsWith('Z') && !str.includes('+') ? str.replace(' ', 'T') + 'Z' : str;
    const d = new Date(iso);
    const ms = d.getTime();
    return isNaN(ms) ? null : ms;
  } catch {
    return null;
  }
}

/**
 * Generates and sends daily activity digest emails to active students.
 * Runs nightly at 9:00 PM IST (or on-demand).
 *
 * @param {Object} options
 * @param {string} [options.targetDate] - Target date in YYYY-MM-DD (defaults to IST today)
 * @param {string} [options.schema]     - Cohort schema to query (defaults to active schema)
 * @param {string} [options.testEmail]  - If provided, sends output to this test email
 * @param {string} [options.studentId]  - If provided, filters to only this student ID
 * @param {boolean} [options.dryRun]    - If true, computes digest without sending email / notification
 * @returns {Promise<Object>} Summary of processing results
 */
export async function generateAndSendDailyDigests({
  targetDate,
  schema,
  testEmail,
  studentId,
  dryRun = false,
} = {}) {
  const date = targetDate || getISTDateString();
  const activeSchema = schema || (await getActiveSchema());

  return runWithSchema(activeSchema, async () => {
    const formattedDate = formatISTDate(date);

    // 1. Fetch all non-cancelled sessions scheduled for the target date
    const sessionRows = await db
      .select({
        id: sessions.id,
        title: sessions.title,
        sessionDate: sessions.sessionDate,
        startTime: sessions.startTime,
        endTime: sessions.endTime,
        status: sessions.status,
        courseId: sessions.courseId,
        courseName: courses.name,
        courseCode: courses.code,
        venueId: sessions.venueId,
        venueName: venues.name,
        facultyFirstName: users.firstName,
        facultyLastName: users.lastName,
      })
      .from(sessions)
      .leftJoin(courses, eq(sessions.courseId, courses.id))
      .leftJoin(venues, eq(sessions.venueId, venues.id))
      .leftJoin(faculty, eq(sessions.facultyId, faculty.id))
      .leftJoin(users, eq(faculty.id, users.id))
      .where(
        and(
          eq(sessions.sessionDate, date),
          ne(sessions.status, 'cancelled')
        )
      )
      .orderBy(asc(sessions.startTime));

    if (!sessionRows || sessionRows.length === 0) {
      return {
        success: true,
        message: `No active sessions scheduled for ${date} (${formattedDate})`,
        date,
        formattedDate,
        schema: activeSchema,
        totalSessions: 0,
        sentCount: 0,
        failedCount: 0,
        digests: [],
      };
    }

    const sessionIds = sessionRows.map((s) => s.id);

    // 2. Query active students
    let studentRows = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        enrollmentNo: students.enrollmentNo,
      })
      .from(users)
      .innerJoin(students, eq(users.id, students.id))
      .where(
        and(
          eq(users.role, 'student'),
          eq(users.isActive, true)
        )
      );

    if (studentId) {
      studentRows = studentRows.filter((s) => s.id === studentId);
    } else if (testEmail && !dryRun) {
      // If a specific test email was passed and matches a student, filter to them;
      // otherwise, if it's an external tester email, keep the first student as template.
      const matched = studentRows.find((s) => s.email.toLowerCase() === testEmail.toLowerCase());
      if (matched) {
        studentRows = [matched];
      } else if (studentRows.length > 0) {
        studentRows = [studentRows[0]];
      }
    }

    if (studentRows.length === 0) {
      return {
        success: true,
        message: 'No matching active students found',
        date,
        formattedDate,
        schema: activeSchema,
        totalSessions: sessionRows.length,
        sentCount: 0,
        failedCount: 0,
        digests: [],
      };
    }

    // 3. Query attendance records for all of today's sessions
    const attRows = await db
      .select({
        sessionId: attendanceRecords.sessionId,
        studentId: attendanceRecords.studentId,
        status: attendanceRecords.status,
        firstSeenAt: attendanceRecords.firstSeenAt,
        lastSeenAt: attendanceRecords.lastSeenAt,
        durationMinutes: attendanceRecords.durationMinutes,
        points: attendanceRecords.points,
      })
      .from(attendanceRecords)
      .where(inArray(attendanceRecords.sessionId, sessionIds));

    // Map: `${sessionId}_${studentId}` -> attendanceRecord
    const attMap = new Map();
    for (const r of attRows) {
      attMap.set(`${r.sessionId}_${r.studentId}`, r);
    }

    // 4. Query attendance ping logs as fallback for first seen time if needed
    const pingMap = new Map();
    try {
      const pingRows = await db
        .select({
          sessionId: attendancePingLogs.sessionId,
          studentId: attendancePingLogs.studentId,
          pingTime: attendancePingLogs.pingTime,
        })
        .from(attendancePingLogs)
        .where(inArray(attendancePingLogs.sessionId, sessionIds));

      for (const p of pingRows) {
        const key = `${p.sessionId}_${p.studentId}`;
        const existing = pingMap.get(key);
        if (!existing || new Date(p.pingTime) < new Date(existing)) {
          pingMap.set(key, p.pingTime);
        }
      }
    } catch (pingErr) {
      // Non-fatal if table is empty or unavailable
      console.warn('Daily digest: attendancePingLogs fallback unavailable:', pingErr.message);
    }

    // 5. Query feedback submissions for today's sessions
    const feedbackRows = await db
      .select({
        sessionId: feedbackResponses.sessionId,
        studentId: feedbackResponses.studentId,
      })
      .from(feedbackResponses)
      .where(inArray(feedbackResponses.sessionId, sessionIds));

    const feedbackSet = new Set(
      feedbackRows.map((fb) => `${fb.sessionId}_${fb.studentId}`)
    );

    // 6. Batch load user notification preferences
    const prefMap = await fetchPreferencesMap(
      db,
      studentRows.map((s) => s.id)
    );

    let sentCount = 0;
    let failedCount = 0;
    const errors = [];
    const generatedDigests = [];

    // 7. Process digest for each student
    for (const student of studentRows) {
      const studentFullName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Student';
      const studentKeyPrefix = `_${student.id}`;

      let attendedCount = 0;
      let absentCount = 0;
      let feedbackSubmittedCount = 0;

      let earliestTimestampMs = null;
      let earliestEntryTimeStr = null;
      let earliestEntryVenue = null;

      const sessionItems = sessionRows.map((s) => {
        const attKey = `${s.id}${studentKeyPrefix}`;
        const att = attMap.get(attKey);
        const fallbackPingTime = pingMap.get(attKey);

        const status = att?.status || 'absent';
        const isAttended = status === 'present' || status === 'partial';
        if (isAttended) {
          attendedCount++;
        } else if (status === 'absent') {
          absentCount++;
        }

        // Determine earliest detection time in this session
        const rawFirstSeen = att?.firstSeenAt || fallbackPingTime || null;
        const formattedFirstSeen = rawFirstSeen ? formatISTTime(rawFirstSeen) : null;

        // Check overall earliest check-in across the entire day
        const epochMs = toEpochMs(rawFirstSeen);
        if (epochMs != null) {
          if (earliestTimestampMs == null || epochMs < earliestTimestampMs) {
            earliestTimestampMs = epochMs;
            earliestEntryTimeStr = formattedFirstSeen;
            earliestEntryVenue = s.venueName || 'Campus';
          }
        }

        // Feedback form status
        const hasFeedback = feedbackSet.has(attKey);
        if (hasFeedback) {
          feedbackSubmittedCount++;
        }

        const facultyName = `${s.facultyFirstName || ''} ${s.facultyLastName || ''}`.trim() || 'CiPD Faculty';

        return {
          id: s.id,
          title: s.title,
          courseCode: s.courseCode || '',
          courseName: s.courseName || s.title,
          startTime: formatISTTime(s.startTime) || s.startTime,
          endTime: formatISTTime(s.endTime) || s.endTime,
          venue: s.venueName || 'Campus Venue',
          faculty: facultyName,
          attendanceStatus: status,
          firstSeenAt: formattedFirstSeen,
          durationMinutes: att?.durationMinutes != null ? Math.round(Number(att.durationMinutes)) : 0,
          points: att?.points != null ? Number(att.points) : null,
          feedbackStatus: hasFeedback ? 'submitted' : 'pending',
        };
      });

      const totalSessions = sessionRows.length;
      const feedbackPendingCount = Math.max(0, totalSessions - feedbackSubmittedCount);

      const digest = {
        date,
        formattedDate,
        firstEntryTime: earliestEntryTimeStr || null,
        firstEntryVenue: earliestEntryVenue || (earliestEntryTimeStr ? 'Campus' : 'No check-in detected'),
        totalSessions,
        attendedCount,
        absentCount,
        feedbackSubmittedCount,
        feedbackPendingCount,
        sessions: sessionItems,
      };

      generatedDigests.push({
        studentId: student.id,
        studentEmail: student.email,
        studentName: studentFullName,
        digest,
      });

      if (dryRun) {
        continue;
      }

      // Check notification preferences (mapped to systemAnnouncements / attendanceAlerts)
      if (!shouldNotifyUser(prefMap, student.id, 'attendance_warning') && !shouldNotifyUser(prefMap, student.id, 'general')) {
        continue;
      }

      try {
        const recipientEmail = testEmail || student.email;
        await sendDailyStudentDigestEmail(recipientEmail, studentFullName, digest);

        // Record in-app notification feed item
        await db.insert(notifications).values({
          recipientId: student.id,
          type: 'daily_digest',
          title: `📋 Daily Activity Summary · ${formattedDate}`,
          message: `Attended: ${attendedCount}/${totalSessions} | First check-in: ${earliestEntryTimeStr || 'None'} | Feedback: ${feedbackPendingCount > 0 ? `${feedbackPendingCount} pending` : 'All submitted'}`,
          isRead: false,
        });

        sentCount++;
      } catch (err) {
        console.error(`Daily digest failed for student ${student.email}:`, err.message);
        failedCount++;
        errors.push({
          studentId: student.id,
          email: student.email,
          error: err.message,
        });
      }
    }

    return {
      success: true,
      message: `Daily digests processed for ${formattedDate}`,
      date,
      formattedDate,
      schema: activeSchema,
      totalSessions: sessionRows.length,
      totalStudents: studentRows.length,
      sentCount,
      failedCount,
      errors: errors.length > 0 ? errors : undefined,
      digests: dryRun ? generatedDigests : undefined,
    };
  });
}
