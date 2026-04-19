/**
 * Attendance Points Calculator
 * 
 * NEW SYSTEM (0–6 scale):
 *   Attendance (normal): 0–5 points based on ping presence %
 *     - ≥ 85% → 5 points
 *     - ≥ 70% → 4 points
 *     - ≥ 45% → 3 points
 *     - < 45% → 0 points (absent)
 *
 *   Bonus: 0–1 point
 *     - +1 if present in first 2 snapshots (within ~8 min of class start, pings every 4 min)
 *
 *   Total per session: max 6 (5 attendance + 1 bonus)
 */

/**
 * @param {Set} studentSnapshotIds  - Set of snapshot IDs this student was seen in
 * @param {string[]} orderedSnapshotIds - All snapshot IDs in session, ordered by time
 * @param {number} [expectedTotalSnapshots] - Expected snapshots from session duration / scanner interval
 * @returns {{ points: number, bonusPoints: number, attendancePoints: number, status: string, breakdown: object }}
 */
export function calculatePoints(studentSnapshotIds, orderedSnapshotIds, expectedTotalSnapshots = 0) {
  const actualSnapshots = orderedSnapshotIds.length;
  // Use the larger of actual vs expected so scanner downtime can't inflate %
  const totalSnapshots = Math.max(actualSnapshots, expectedTotalSnapshots || 0);
  const pingCount = studentSnapshotIds.size;

  // No snapshots in session yet — can't calculate
  if (totalSnapshots === 0) {
    return {
      points: 0,
      attendancePoints: 0,
      bonusPoints: 0,
      status: 'absent',
      breakdown: {
        presencePercent: 0,
        attendancePoints: 0,
        bonusPoints: 0,
        tier: 'none',
        reason: 'No snapshots in session',
      },
    };
  }

  // Student not seen at all
  if (pingCount === 0) {
    return {
      points: 0,
      attendancePoints: 0,
      bonusPoints: 0,
      status: 'absent',
      breakdown: {
        presencePercent: 0,
        attendancePoints: 0,
        bonusPoints: 0,
        tier: 'none',
        reason: 'Not detected',
      },
    };
  }

  const presencePercent = (pingCount / totalSnapshots) * 100;

  // ── Attendance points (0–5) based on presence % ──
  let attendancePoints = 0;
  let tier = '';

  if (presencePercent >= 85) {
    attendancePoints = 5;
    tier = '≥85%';
  } else if (presencePercent >= 70) {
    attendancePoints = 4;
    tier = '≥70%';
  } else if (presencePercent >= 45) {
    attendancePoints = 3;
    tier = '≥45%';
  } else {
    attendancePoints = 0;
    tier = '<45%';
  }

  // If attendance is 0, mark absent
  if (attendancePoints === 0) {
    return {
      points: 0,
      attendancePoints: 0,
      bonusPoints: 0,
      status: 'absent',
      breakdown: {
        presencePercent: Math.round(presencePercent),
        attendancePoints: 0,
        bonusPoints: 0,
        tier,
        reason: `Presence ${Math.round(presencePercent)}% (< 45%) → Absent`,
      },
    };
  }

  // ── Bonus point (+1 for early arrival) ──
  // Present in any of the first 2 snapshots = within first ~8 minutes
  const first2 = orderedSnapshotIds.slice(0, 2);
  const presentInFirst2 = first2.some(id => studentSnapshotIds.has(id));
  const bonusPoints = presentInFirst2 ? 1 : 0;

  const totalPoints = attendancePoints + bonusPoints;
  const status = 'present';

  let reason = `Presence ${Math.round(presencePercent)}% → ${attendancePoints} pts`;
  if (bonusPoints > 0) {
    reason += ' + 1 early bonus';
  } else {
    reason += ' (no early bonus)';
  }

  return {
    points: totalPoints,
    attendancePoints,
    bonusPoints,
    status,
    breakdown: {
      presencePercent: Math.round(presencePercent),
      attendancePoints,
      bonusPoints,
      tier,
      reason,
    },
  };
}
