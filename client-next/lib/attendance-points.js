/**
 * Attendance Points Calculator
 *
 * Start credit (EITHER/OR — a student gets one, never both):
 *   scanned the start QR → 5 pts (Wi-Fi is ignored)
 *   otherwise Wi-Fi first detection after session start:
 *     0–5 min → 4, 5–10 min → 3, 10–15 min → 2, later → 0
 * End-of-class QR → +2 (always additive). Max total = 7.
 *
 * Status: present if total points > 0. No-show = 0 pts, absent
 * (no penalty); approved leave with no points → leave.
 */

const MS_PER_MIN = 60 * 1000;
/** Small buffer for cron/scanner lag (6 seconds) */
export const CRON_TIMING_BUFFER_MS = 6 * 1000;

/** Wi-Fi tiers: [max minutes after start, points]. */
export const WIFI_TIERS = [
  [5, 4],
  [10, 3],
  [15, 2],
];
export const QR_POINTS = { start: 5, end: 2 };

/**
 * @param {number} minutesAfterStart - minutes from session start (negative = early)
 */
export function calculateWifiScore(minutesAfterStart) {
  for (const [maxMin, pts] of WIFI_TIERS) {
    if (minutesAfterStart <= maxMin) return pts;
  }
  return 0;
}

/** @param {Iterable<string>} phases - QR phases scanned ('start' | 'end') */
export function calculateQrPoints(phases = []) {
  let total = 0;
  for (const phase of new Set(phases)) total += QR_POINTS[phase] || 0;
  return total;
}

/**
 * @param {object} params
 * @param {Date|null} params.firstSeenAt
 * @param {Date|null} params.lastSeenAt
 * @param {Date} params.sessionStartAt
 * @param {Date} params.sessionEndAt
 * @param {boolean} [params.leaveApproved]
 * @param {boolean} [params.detected]
 * @param {boolean} [params.finalizeAbsent]
 * @param {string[]} [params.qrPhases] - QR phases scanned ('start' | 'end')
 * @returns {{ points: number, wifiScore: number, durationPercent: number, status: string, breakdown: object }}
 */
export function calculatePoints({
  firstSeenAt,
  lastSeenAt,
  sessionStartAt,
  sessionEndAt,
  leaveApproved = false,
  detected = true,
  finalizeAbsent = false,
  qrPhases = [],
}) {
  const qrPoints = calculateQrPoints(qrPhases);
  const startQr = qrPhases.includes('start');
  const sessionDurationMin = Math.max(
    1,
    (sessionEndAt.getTime() - sessionStartAt.getTime()) / MS_PER_MIN
  );

  let wifiScore = 0;
  let durationPercent = 0;
  let minutesAfterStart = null;
  let durationMin = 0;
  const wifiDetected = detected && firstSeenAt && lastSeenAt;
  // Start QR and Wi-Fi are mutually exclusive: a start scan replaces the Wi-Fi tier.

  if (wifiDetected) {
    // Duration is informational only; it no longer affects points or status.
    durationMin = (lastSeenAt.getTime() - firstSeenAt.getTime()) / MS_PER_MIN;
    durationPercent = Math.min(100, (durationMin / sessionDurationMin) * 100);
    minutesAfterStart =
      (firstSeenAt.getTime() - sessionStartAt.getTime() - CRON_TIMING_BUFFER_MS) / MS_PER_MIN;
    wifiScore = startQr ? 0 : calculateWifiScore(minutesAfterStart);
  }

  const points = wifiScore + qrPoints;

  let status;
  let tier;
  if (points > 0) {
    status = 'present';
    tier = startQr
      ? 'Start QR scanned (Wi-Fi not counted)'
      : wifiDetected
      ? `Wi-Fi first seen ${Math.round(minutesAfterStart * 10) / 10} min after start → ${wifiScore} pts`
      : 'Not seen on Wi-Fi';
    if (qrPhases.includes('end')) tier += ', end QR +2';
  } else if (!finalizeAbsent) {
    status = 'absent';
    tier = 'pending';
  } else if (leaveApproved) {
    status = 'leave';
    tier = 'leave';
  } else {
    status = 'absent';
    tier = 'absent';
  }

  const reasons = {
    pending: 'Not yet scored',
    leave: 'Approved leave — no penalty',
    absent: wifiDetected
      ? `Wi-Fi first seen ${Math.round(minutesAfterStart * 10) / 10} min after start → 0 pts`
      : 'No score earned → absent',
  };

  return {
    points,
    wifiScore,
    qrPoints,
    durationPercent: Math.round(durationPercent),
    status,
    breakdown: {
      wifiScore,
      qrPoints,
      durationPercent: Math.round(durationPercent),
      minutesAfterStart:
        minutesAfterStart === null ? null : Math.round(minutesAfterStart * 10) / 10,
      durationMin: Math.round(durationMin * 10) / 10,
      tier,
      reason: points > 0 ? `${tier} (Total: ${points} pts)` : reasons[tier],
    },
  };
}

/**
 * Attendance status follows points: present iff total points > 0.
 * `points` is what the student has earned so far (during a live session that
 * is just QR points).
 *
 * @returns {'present'|'partial'|'absent'|'leave'|'missing'}
 */
export function resolveAttendanceStatus({
  points = 0,
  detected = false,
  leaveApproved = false,
  finalizeAbsent = false,
  isOngoing = false,
}) {
  if (points > 0) return 'present';

  if (isOngoing) {
    if (leaveApproved) return 'leave';
    if (!detected) return 'missing';
    return 'partial';
  }

  if (leaveApproved) return 'leave';
  if (!detected && !finalizeAbsent) return 'missing';
  return 'absent';
}

/**
 * Map DB/live status to student-facing label on /attendance.
 */
export function liveStatusLabel(status, isOngoing) {
  if (!isOngoing) {
    if (status === 'present' || status === 'partial') return 'Present';
    if (status === 'leave') return 'Leave';
    return 'Absent';
  }
  if (status === 'leave') return 'On Leave';
  if (status === 'partial' || status === 'present') return 'Attending';
  return 'Missing';
}
