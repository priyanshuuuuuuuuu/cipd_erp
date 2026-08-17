/**
 * Attendance Points Calculator
 *
 * Arrival Bonus:
 *   ≤ 6.1 min after start (or before start) → +1 point
 *
 * Duration Score (lastSeen - firstSeen):
 *   ≥ 80% of session → +4
 *   ≥ 70% of session → +3
 *   ≥ 60% of session → +2
 *   ≥ 50% of session → +1
 *   < 50% of session → +0.5
 *
 * Final Score = Arrival Bonus + Duration Score
 *
 * No-show without approved leave: −2
 * No-show with approved leave: 0 (status: leave)
 */

const MS_PER_MIN = 60 * 1000;
/** Small buffer for cron/scanner lag (6 seconds) */
export const CRON_TIMING_BUFFER_MS = 6 * 1000;

/**
 * @param {number} minutesAfterStart - minutes from session start (negative = early)
 */
export function calculateArrivalBonus(minutesAfterStart) {
  return minutesAfterStart <= 6.1 ? 1 : 0;
}

/**
 * @param {number} durationPercent
 * @returns {number} duration score
 */
export function calculateDurationScore(durationPercent) {
  if (durationPercent >= 80) return 4;
  if (durationPercent >= 70) return 3;
  if (durationPercent >= 60) return 2;
  if (durationPercent >= 50) return 1;
  return 0.5;
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
 * @returns {{ points: number, arrivalBonus: number, durationScore: number, durationPercent: number, status: string, breakdown: object }}
 */
export function calculatePoints({
  firstSeenAt,
  lastSeenAt,
  sessionStartAt,
  sessionEndAt,
  leaveApproved = false,
  detected = true,
  finalizeAbsent = false,
}) {
  const sessionDurationMin = Math.max(
    1,
    (sessionEndAt.getTime() - sessionStartAt.getTime()) / MS_PER_MIN
  );

  if (!detected || !firstSeenAt || !lastSeenAt) {
    if (!finalizeAbsent) {
      return {
        points: 0,
        arrivalBonus: 0,
        durationScore: 0,
        durationPercent: 0,
        status: 'absent',
        breakdown: {
          reason: 'Not yet detected',
          tier: 'pending',
          durationPercent: 0,
        },
      };
    }

    if (leaveApproved) {
      return {
        points: 0,
        arrivalBonus: 0,
        durationScore: 0,
        durationPercent: 0,
        status: 'leave',
        breakdown: {
          reason: 'Approved leave — no penalty',
          tier: 'leave',
          durationPercent: 0,
        },
      };
    }

    return {
      points: -2,
      arrivalBonus: 0,
      durationScore: 0,
      durationPercent: 0,
      status: 'absent',
      breakdown: {
        reason: 'Absent without approved leave → −2 pts',
        tier: 'absent',
        durationPercent: 0,
      },
    };
  }

  const durationMin = (lastSeenAt.getTime() - firstSeenAt.getTime()) / MS_PER_MIN;
  let durationPercent = (durationMin / sessionDurationMin) * 100;
  
  // Cap at 100% just in case of slight timing overflow
  if (durationPercent > 100) durationPercent = 100;

  const msAfterStart =
    firstSeenAt.getTime() - sessionStartAt.getTime() + CRON_TIMING_BUFFER_MS;
  const minutesAfterStart = msAfterStart / MS_PER_MIN;

  const arrivalBonus = calculateArrivalBonus(minutesAfterStart);
  const durationScore = calculateDurationScore(durationPercent);
  const points = arrivalBonus + durationScore;

  let tier = `duration ${Math.round(durationPercent)}% → ${durationScore} pts`;
  if (arrivalBonus > 0) tier += `, on-time bonus +${arrivalBonus}`;

  return {
    points,
    arrivalBonus,
    durationScore,
    durationPercent: Math.round(durationPercent),
    breakdown: {
      durationPercent: Math.round(durationPercent),
      arrivalBonus,
      durationScore,
      minutesAfterStart: Math.round(minutesAfterStart * 10) / 10,
      durationMin: Math.round(durationMin * 10) / 10,
      tier,
      reason: `${tier} (Total: ${points} pts)`,
    },
  };
}

/** Minimum duration % to count as present (below this → absent). */
export const MIN_DURATION_PERCENT = 25;

/**
 * Attendance status is separate from points.
 * Present/absent is driven by duration %; points use duration score + arrival bonus.
 *
 * @returns {'present'|'partial'|'absent'|'leave'|'missing'}
 */
export function resolveAttendanceStatus({
  durationPercent = 0,
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

  if (durationPercent < MIN_DURATION_PERCENT) return 'absent';
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
