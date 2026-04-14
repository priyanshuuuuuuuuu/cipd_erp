/**
 * Attendance Points Calculator
 * 
 * Points: 0.0 to 1.0
 * Rules:
 *   1. Start with 1.0
 *   2. If NOT present in first 2 snapshots → -0.5 (late penalty)
 *   3. Check presence % (how many snapshots out of total):
 *      - < 30% → mark absent (points = 0)
 *      - < 50% → deduct 0.3 more
 *      - < 75% → deduct 0.2 more
 *      - ≥ 75% → no extra deduction
 */

/**
 * @param {Set} studentSnapshotIds  - Set of snapshot IDs this student was seen in
 * @param {string[]} orderedSnapshotIds - All snapshot IDs in session, ordered by time
 * @param {number} [expectedTotalSnapshots] - Expected snapshots from session duration / scanner interval
 * @returns {{ points: number, status: string, breakdown: object }}
 */
export function calculatePoints(studentSnapshotIds, orderedSnapshotIds, expectedTotalSnapshots = 0) {
  const actualSnapshots = orderedSnapshotIds.length;
  // Use the larger of actual vs expected so scanner downtime can't inflate %
  const totalSnapshots = Math.max(actualSnapshots, expectedTotalSnapshots || 0);
  const pingCount = studentSnapshotIds.size;

  // No snapshots in session yet — can't calculate
  if (totalSnapshots === 0) {
    return { points: 0, status: 'absent', breakdown: { base: 0, latePenalty: 0, presencePenalty: 0, reason: 'No snapshots in session' } };
  }

  // Student not seen at all
  if (pingCount === 0) {
    return { points: 0, status: 'absent', breakdown: { base: 0, latePenalty: 0, presencePenalty: 0, reason: 'Not detected' } };
  }

  const presencePercent = (pingCount / totalSnapshots) * 100;

  let points = 1.0;
  let latePenalty = 0;
  let presencePenalty = 0;
  let reason = '';

  // Rule 1: Late check — not present in first 2 snapshots
  const first2 = orderedSnapshotIds.slice(0, 2);
  const presentInFirst2 = first2.some(id => studentSnapshotIds.has(id));
  if (!presentInFirst2) {
    latePenalty = 0.5;
    points -= 0.5;
    reason = 'Late (-0.5)';
  }

  // Rule 2: Presence percentage check (else-if chain, worst first)
  if (presencePercent < 30) {
    // Mark absent entirely
    return {
      points: 0,
      status: 'absent',
      breakdown: {
        base: 1.0,
        latePenalty,
        presencePenalty: 'absent',
        presencePercent: Math.round(presencePercent),
        reason: `${reason ? reason + ' + ' : ''}Presence < 30% → Absent`,
      },
    };
  } else if (presencePercent < 50) {
    presencePenalty = 0.3;
    points -= 0.3;
    reason += `${reason ? ' + ' : ''}Presence < 50% (-0.3)`;
  } else if (presencePercent < 75) {
    presencePenalty = 0.2;
    points -= 0.2;
    reason += `${reason ? ' + ' : ''}Presence < 75% (-0.2)`;
  }

  // Clamp to 0
  points = Math.max(0, Math.round(points * 100) / 100);

  const status = points > 0 ? 'present' : 'absent';

  return {
    points,
    status,
    breakdown: {
      base: 1.0,
      latePenalty,
      presencePenalty,
      presencePercent: Math.round(presencePercent),
      reason: reason || 'Full attendance (1.0)',
    },
  };
}
