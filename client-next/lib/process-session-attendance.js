import { db } from '@/lib/db';
import {
  systemSettings,
  leaveRequests,
  courseEnrollments,
  students,
  users,
  attendanceRecords,
  sessions as sessionsTable,
} from '@/drizzle/schema';
import { eq, and, inArray, isNotNull, sql } from 'drizzle-orm';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizeMac, isValidMac } from '@/lib/attendance-mac';
import { calculatePoints, resolveAttendanceStatus } from '@/lib/attendance-points';

/**
 * Load system settings for attendance processing.
 */
export async function loadAttendanceSettings() {
  const [settings] = await db
    .select({
      scanner_interval_minutes: systemSettings.scannerIntervalMinutes,
      min_signal: systemSettings.minSignal,
      ping_interval: systemSettings.pingInterval,
      presence_threshold: systemSettings.presenceThreshold,
    })
    .from(systemSettings)
    .where(eq(systemSettings.id, 1));

  return {
    scannerIntervalMin:
      settings?.scanner_interval_minutes || settings?.ping_interval || 6,
    minSignal: settings?.min_signal ?? settings?.presence_threshold ?? 2,
  };
}

/**
 * Build MAC timeline from wifi snapshots.
 * Signal strength filtering is intentionally disabled — nmap-sourced devices
 * have no signal data (null/0) and would be incorrectly dropped otherwise.
 * @param {Array} snapshots
 */
export function buildMacTimeline(snapshots) {
  const macTimeline = {};
  const orderedSnapshotIds = (snapshots || []).map((s) => s.id);

  (snapshots || []).forEach((snap) => {
    let clients = [];
    try {
      let dump = snap.iw_dump;
      if (typeof dump === 'string') dump = JSON.parse(dump);
      if (typeof dump === 'string') dump = JSON.parse(dump);
      clients = Array.isArray(dump) ? dump : [];
    } catch {
      clients = [];
    }

    const snapTime = new Date(snap.captured_at);
    clients.forEach((c) => {
      if (!c.mac || c.mac.trim() === '') return;
      const mac = normalizeMac(c.mac);
      if (!isValidMac(mac)) return;
      const sig = parseInt(c.signal, 10) || 0;

      if (!macTimeline[mac]) macTimeline[mac] = [];
      macTimeline[mac].push({
        snapshotId: snap.id,
        time: snapTime,
        signal: sig,
        deviceName: c.name || '',
        ip: c.ip || '',
      });
    });
  });

  return { macTimeline, orderedSnapshotIds };
}

/**
 * Approved leave lookup: Set of studentIds with approved leave for session/date.
 * @param {string} sessionId
 * @param {string} sessionDate - YYYY-MM-DD
 * @param {string[]} studentIds
 */
export async function loadApprovedLeaves(sessionId, sessionDate, studentIds) {
  const leaveMap = new Set();
  if (!studentIds.length) return leaveMap;

  const leaves = await db
    .select({
      student_id: leaveRequests.studentId,
      session_id: leaveRequests.sessionId,
      leave_date: leaveRequests.leaveDate,
    })
    .from(leaveRequests)
    .where(
      and(
        eq(leaveRequests.status, 'approved'),
        eq(leaveRequests.leaveDate, sessionDate),
        inArray(leaveRequests.studentId, studentIds)
      )
    );

  (leaves || []).forEach((l) => {
    if (!l.session_id || l.session_id === sessionId) {
      leaveMap.add(l.student_id);
    }
  });

  return leaveMap;
}

/**
 * Process attendance for one session.
 * Only enrolled students with verified MAC are scored; others are skipped.
 *
 * @param {object} session - session row with id, session_date, start_time, end_time, course_id
 * @param {object} [options]
 * @param {boolean} [options.isOngoing]
 * @param {boolean} [options.finalizeAbsent]
 * @param {boolean} [options.upsert]
 * @param {Date} [options.now]
 */
export async function processSessionAttendance(session, options = {}) {
  const {
    isOngoing = false,
    finalizeAbsent = !isOngoing,
    upsert = true,
    now = new Date(),
  } = options;

  const { scannerIntervalMin } = await loadAttendanceSettings();
  const date = session.session_date;
  const courseId = session.course_id;

  if (!courseId) {
    return {
      records: [],
      summary: { present: 0, partial: 0, absent: 0, leave: 0, skipped: 0 },
      snapshotsAnalyzed: 0,
      expectedTotalSnapshots: 0,
      scannerIntervalMin,
    };
  }

  const sessionStartDate = new Date(`${date}T${session.start_time}+05:30`);
  const sessionEndDate = new Date(`${date}T${session.end_time}+05:30`);
  const sessionDurationMin = Math.round(
    (sessionEndDate - sessionStartDate) / 60000
  );
  const expectedTotalSnapshots = Math.floor(
    sessionDurationMin / scannerIntervalMin
  );

  const windowEnd = new Date(sessionEndDate);
  windowEnd.setMinutes(windowEnd.getMinutes() + 2);

  const { data: snapshots } = await supabaseAdmin
    .schema('public').from('wifi_snapshots')
    .select('id, iw_dump, captured_at')
    .gte('captured_at', sessionStartDate.toISOString())
    .lte('captured_at', windowEnd.toISOString())
    .order('captured_at', { ascending: true });

  const { macTimeline, orderedSnapshotIds } = buildMacTimeline(snapshots || []);

  const enrollments = await db
    .select({ student_id: courseEnrollments.studentId })
    .from(courseEnrollments)
    .where(eq(courseEnrollments.courseId, courseId));

  const enrolledStudentIds = (enrollments || []).map((e) => e.student_id);
  if (enrolledStudentIds.length === 0) {
    return {
      records: [],
      summary: { present: 0, partial: 0, absent: 0, leave: 0, skipped: 0 },
      snapshotsAnalyzed: (snapshots || []).length,
      expectedTotalSnapshots,
      scannerIntervalMin,
    };
  }

  const verifiedStudents = await db
    .select({
      id: students.id,
      enrollment_no: students.enrollmentNo,
      mac_address: students.macAddress,
      mac_verified: students.macVerified,
    })
    .from(students)
    .innerJoin(users, eq(students.id, users.id))
    .where(
      and(
        inArray(students.id, enrolledStudentIds),
        eq(students.macVerified, true),
        isNotNull(students.macAddress),
        eq(users.isActive, true)
      )
    );

  const approvedLeaves = await loadApprovedLeaves(
    session.id,
    date,
    (verifiedStudents || []).map((s) => s.id)
  );

  const existingRecords = await db
    .select({
      student_id: attendanceRecords.studentId,
      admin_override: attendanceRecords.adminOverride,
      penalty: attendanceRecords.penalty,
    })
    .from(attendanceRecords)
    .where(eq(attendanceRecords.sessionId, session.id));

  const overriddenIds = new Set(
    (existingRecords || [])
      .filter((r) => r.admin_override || r.penalty)
      .map((r) => r.student_id)
  );

  const records = [];
  const summary = { present: 0, partial: 0, absent: 0, leave: 0, skipped: 0 };

  for (const student of (verifiedStudents || [])) {
    if (overriddenIds.has(student.id)) {
      summary.skipped++;
      continue;
    }

    const mac = normalizeMac(student.mac_address);
    const timeline = macTimeline[mac] || [];
    const detected = timeline.length > 0;
    const leaveApproved = approvedLeaves.has(student.id);

    let pingCount = 0;
    let firstSeen = null;
    let lastSeen = null;
    let durationMinutes = 0;
    let avgSignal = 0;

    if (detected) {
      const uniqueSnapshots = new Set(timeline.map((t) => t.snapshotId));
      pingCount = uniqueSnapshots.size;
      firstSeen = timeline[0].time;
      lastSeen = timeline[timeline.length - 1].time;
      durationMinutes =
        Math.round(((lastSeen - firstSeen) / 60000) * 10) / 10;
      avgSignal =
        Math.round(
          (timeline.reduce((a, t) => a + t.signal, 0) / timeline.length) * 10
        ) / 10;
    }

    const actualSnapshots = orderedSnapshotIds.length;
    const totalSnapshots = Math.max(actualSnapshots, expectedTotalSnapshots || 0);

    const scoring = calculatePoints({
      firstSeenAt: firstSeen,
      lastSeenAt: lastSeen,
      sessionStartAt: sessionStartDate,
      sessionEndAt: sessionEndDate,
      leaveApproved,
      detected,
      finalizeAbsent,
    });

    const status = resolveAttendanceStatus({
      durationPercent: scoring.durationPercent ?? 0,
      detected,
      leaveApproved,
      finalizeAbsent,
      isOngoing,
    });

    if (status === 'missing') {
      continue;
    }

    const finalPoints = isOngoing ? 0 : scoring.points;

    records.push({
      session_id: session.id,
      student_id: student.id,
      ping_count: pingCount,
      points: finalPoints,
      status: status === 'missing' ? 'absent' : status,
      calculated_at: now.toISOString(),
      first_seen_at: firstSeen ? firstSeen.toISOString() : null,
      last_seen_at: lastSeen ? lastSeen.toISOString() : null,
      duration_minutes: durationMinutes,
      avg_signal_strength: avgSignal,
      _breakdown: scoring.breakdown,
    });

    if (status === 'present') summary.present++;
    else if (status === 'partial') summary.partial++;
    else if (status === 'leave') summary.leave++;
    else summary.absent++;
  }

  if (upsert && records.length > 0) {
    const upsertRows = records.map(({ _breakdown, ...row }) => ({
      sessionId: row.session_id,
      studentId: row.student_id,
      pingCount: row.ping_count,
      points: String(row.points),
      status: row.status,
      calculatedAt: row.calculated_at,
      firstSeenAt: row.first_seen_at,
      lastSeenAt: row.last_seen_at,
      durationMinutes: String(row.duration_minutes),
      avgSignalStrength: String(row.avg_signal_strength),
    }));

    await db
      .insert(attendanceRecords)
      .values(upsertRows)
      .onConflictDoUpdate({
        target: [attendanceRecords.sessionId, attendanceRecords.studentId],
        set: {
          pingCount: sql`excluded.ping_count`,
          points: sql`excluded.points`,
          status: sql`excluded.status`,
          calculatedAt: sql`excluded.calculated_at`,
          firstSeenAt: sql`excluded.first_seen_at`,
          lastSeenAt: sql`excluded.last_seen_at`,
          durationMinutes: sql`excluded.duration_minutes`,
          avgSignalStrength: sql`excluded.avg_signal_strength`,
        },
      });
  }

  return {
    records,
    summary,
    snapshotsAnalyzed: (snapshots || []).length,
    expectedTotalSnapshots,
    scannerIntervalMin,
  };
}

/**
 * Fetch session with course_id for processing.
 * @param {string} sessionId
 */
export async function fetchSessionForProcessing(sessionId) {
  const [session] = await db
    .select({
      id: sessionsTable.id,
      title: sessionsTable.title,
      session_date: sessionsTable.sessionDate,
      start_time: sessionsTable.startTime,
      end_time: sessionsTable.endTime,
      status: sessionsTable.status,
      course_id: sessionsTable.courseId,
    })
    .from(sessionsTable)
    .where(eq(sessionsTable.id, sessionId));

  return session || null;
}
