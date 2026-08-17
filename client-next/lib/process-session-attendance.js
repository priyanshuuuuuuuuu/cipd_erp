import { supabaseAdmin } from '@/lib/supabase';
import { normalizeMac, isValidMac } from '@/lib/attendance-mac';
import { calculatePoints, resolveAttendanceStatus } from '@/lib/attendance-points';

/**
 * Load system settings for attendance processing.
 */
export async function loadAttendanceSettings() {
  const { data: settings } = await supabaseAdmin
    .from('system_settings')
    .select('scanner_interval_minutes, min_signal, ping_interval, presence_threshold')
    .eq('id', 1)
    .single();

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
      // Signal strength filter intentionally removed:
      // nmap devices have signal=null which parsed to 0 and were incorrectly excluded.
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

  const { data: leaves, error } = await supabaseAdmin
    .from('leave_requests')
    .select('student_id, session_id, leave_date')
    .eq('status', 'approved')
    .eq('leave_date', sessionDate)
    .in('student_id', studentIds);

  if (error) {
    console.error('loadApprovedLeaves error:', error.message);
    return leaveMap;
  }

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

  const { data: enrollments } = await supabaseAdmin
    .from('course_enrollments')
    .select('student_id')
    .eq('course_id', courseId);

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

  const { data: students } = await supabaseAdmin
    .from('students')
    .select('id, enrollment_no, mac_address, mac_verified')
    .in('id', enrolledStudentIds)
    .eq('mac_verified', true)
    .not('mac_address', 'is', null);

  const verifiedStudents = students || [];

  const approvedLeaves = await loadApprovedLeaves(
    session.id,
    date,
    verifiedStudents.map((s) => s.id)
  );

  const { data: existingRecords } = await supabaseAdmin
    .from('attendance_records')
    .select('student_id, admin_override, penalty')
    .eq('session_id', session.id);

  const overriddenIds = new Set(
    (existingRecords || [])
      .filter((r) => r.admin_override || r.penalty)
      .map((r) => r.student_id)
  );

  const records = [];
  const summary = { present: 0, partial: 0, absent: 0, leave: 0, skipped: 0 };

  for (const student of verifiedStudents) {
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
    const presencePercent =
      totalSnapshots > 0 ? (pingCount / totalSnapshots) * 100 : 0;

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
    const upsertRows = records.map(({ _breakdown, ...row }) => row);
    const { error: upsertErr } = await supabaseAdmin
      .from('attendance_records')
      .upsert(upsertRows, {
        onConflict: 'session_id,student_id',
        ignoreDuplicates: false,
      });
    if (upsertErr) {
      console.error(`Attendance upsert error for session ${session.id}:`, upsertErr);
      throw upsertErr;
    }
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
  const { data: session, error } = await supabaseAdmin
    .from('sessions')
    .select('id, title, session_date, start_time, end_time, status, course_id')
    .eq('id', sessionId)
    .single();

  if (error || !session) return null;
  return session;
}
