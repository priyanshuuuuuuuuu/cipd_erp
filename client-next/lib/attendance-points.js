/**
 * Attendance Points Calculator
 *
 * Base score from first-ping timing vs session start (0–5):
 *   ≤ 6.1 min after start (or before start) → 5
 *   6.1 – 12.1 min  → 4
 *   12.1 – 18.1 min → 3
 *   18.1 – 30.1 min → 2
 *   30.1 min – half-time → 1
 *   after half-time → 0.5
 *
 * Ping-% deduction from base (monotonic):
 *   ≥ 80% → no loss
 *   ≥ 70% → −1
 *   ≥ 45% → −2
 *   < 45% → −2
 *
 * Final: max(0, base − deduction)
 * No-show without approved leave: −2
 * No-show with approved leave: 0 (status: leave)
 */

const MS_PER_MIN = 60 * 1000;
/** Small buffer for cron/scanner lag (6 seconds) */
export const CRON_TIMING_BUFFER_MS = 6 * 1000;

/**
 * @param {number} minutesAfterStart - minutes from session start (negative = early)
 * @param {number} sessionDurationMin - total session length in minutes
 */
export function calculateLateEntryBasePoints(minutesAfterStart, sessionDurationMin) {
  const halfTimeMin = sessionDurationMin / 2;

  if (minutesAfterStart <= 6.1) return 5;
  if (minutesAfterStart <= 12.1) return 4;
  if (minutesAfterStart <= 18.1) return 3;
  if (minutesAfterStart <= 30.1) return 2;
  if (minutesAfterStart <= halfTimeMin) return 1;
  return 0.5;
}

/**
 * @param {number} presencePercent
 * @returns {number} points to deduct
 */
export function calculatePingDeduction(presencePercent) {
  if (presencePercent >= 80) return 0;
  if (presencePercent >= 70) return 1;
  return 2;
}

/**
 * @param {object} params
 * @param {Date|null} params.firstSeenAt
 * @param {Date} params.sessionStartAt
 * @param {Date} params.sessionEndAt
 * @param {number} params.pingCount
 * @param {string[]} params.orderedSnapshotIds
 * @param {number} [params.expectedTotalSnapshots]
 * @param {boolean} [params.leaveApproved]
 * @param {boolean} [params.detected]
 * @param {boolean} [params.finalizeAbsent]
 * @returns {{ points: number, basePoints: number, pingDeduction: number, status: string, breakdown: object }}
 */
export function calculatePoints({
  firstSeenAt,
  sessionStartAt,
  sessionEndAt,
  pingCount,
  orderedSnapshotIds,
  expectedTotalSnapshots = 0,
  leaveApproved = false,
  detected = true,
  finalizeAbsent = false,
}) {
  const sessionDurationMin = Math.max(
    1,
    (sessionEndAt.getTime() - sessionStartAt.getTime()) / MS_PER_MIN
  );

  if (!detected) {
    if (!finalizeAbsent) {
      return {
        points: 0,
        basePoints: 0,
        pingDeduction: 0,
        status: 'absent',
        breakdown: {
          reason: 'Not yet detected',
          tier: 'pending',
          presencePercent: 0,
        },
      };
    }

    if (leaveApproved) {
      return {
        points: 0,
        basePoints: 0,
        pingDeduction: 0,
        status: 'leave',
        breakdown: {
          reason: 'Approved leave — no penalty',
          tier: 'leave',
          presencePercent: 0,
        },
      };
    }

    return {
      points: -2,
      basePoints: 0,
      pingDeduction: 0,
      status: 'absent',
      breakdown: {
        reason: 'Absent without approved leave → −2 pts',
        tier: 'absent',
        presencePercent: 0,
      },
    };
  }

  const actualSnapshots = orderedSnapshotIds.length;
  const totalSnapshots = Math.max(actualSnapshots, expectedTotalSnapshots || 0);

  if (totalSnapshots === 0 || pingCount === 0) {
    return calculatePoints({
      firstSeenAt: null,
      sessionStartAt,
      sessionEndAt,
      pingCount: 0,
      orderedSnapshotIds,
      expectedTotalSnapshots,
      leaveApproved,
      detected: false,
      finalizeAbsent,
    });
  }

  const presencePercent = (pingCount / totalSnapshots) * 100;
  const msAfterStart =
    firstSeenAt.getTime() - sessionStartAt.getTime() + CRON_TIMING_BUFFER_MS;
  const minutesAfterStart = msAfterStart / MS_PER_MIN;

  const basePoints = calculateLateEntryBasePoints(minutesAfterStart, sessionDurationMin);
  const pingDeduction = calculatePingDeduction(presencePercent);
  const points = Math.max(0, basePoints - pingDeduction);

  let tier = `late ${minutesAfterStart.toFixed(1)}min → base ${basePoints}`;
  if (pingDeduction > 0) tier += `, ping ${Math.round(presencePercent)}% −${pingDeduction}`;

  return {
    points,
    basePoints,
    pingDeduction,
    presencePercent: Math.round(presencePercent),
    breakdown: {
      presencePercent: Math.round(presencePercent),
      basePoints,
      pingDeduction,
      minutesAfterStart: Math.round(minutesAfterStart * 10) / 10,
      tier,
      reason: `${tier} → ${points} pts`,
    },
  };
}

/** Minimum ping % to count as present (below this → absent). */
export const MIN_PRESENCE_PERCENT = 45;

/**
 * Attendance status is separate from points.
 * Present/absent is driven by ping %; points use entry time + deductions.
 *
 * @returns {'present'|'partial'|'absent'|'leave'|'missing'}
 */
export function resolveAttendanceStatus({
  presencePercent = 0,
  detected = false,
  leaveApproved = false,
  finalizeAbsent = false,
  isOngoing = false,
}) {
  if (isOngoing) {
    if (leaveApproved) return 'leave';
    if (!detected) return 'missing';
    return 'partial';
  }

  if (!detected) {
    if (leaveApproved) return 'leave';
    return finalizeAbsent ? 'absent' : 'missing';
  }

  if (presencePercent < MIN_PRESENCE_PERCENT) return 'absent';
  return 'present';
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
