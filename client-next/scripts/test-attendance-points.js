/**
 * Unit Tests for Attendance Points System
 * 
 * Run: node scripts/test-attendance-points.js
 * 
 * Tests the calculatePoints function with all edge cases.
 */

import { calculatePoints } from '../lib/attendance-points.js';

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.log(`  ✗ ${testName} ${details}`);
    failed++;
  }
}

function assertPoints(studentSnapshotIds, orderedSnapshotIds, expectedPoints, expectedStatus, testName) {
  const result = calculatePoints(new Set(studentSnapshotIds), orderedSnapshotIds);
  const pointsMatch = Math.abs(result.points - expectedPoints) < 0.01;
  const statusMatch = result.status === expectedStatus;

  assert(pointsMatch && statusMatch, testName,
    `→ Got points=${result.points} status="${result.status}", expected points=${expectedPoints} status="${expectedStatus}" | ${result.breakdown?.reason || ''}`
  );
  return result;
}

// ─── Test Suite ───

console.log('\n╔═══════════════════════════════════════════════╗');
console.log('║   Attendance Points — Unit Tests              ║');
console.log('╚═══════════════════════════════════════════════╝\n');

// Generate snapshot IDs
const snaps = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10'];

// ── 1. Perfect attendance ──
console.log('1. Perfect Attendance (on time + 100% presence)');
assertPoints(
  ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10'],
  snaps,
  1.0, 'present',
  'All 10/10 snapshots → 1.0 pts'
);

// ── 2. Late penalty ──
console.log('\n2. Late Penalty (not in first 2 snapshots)');
assertPoints(
  ['s3', 's4', 's5', 's6', 's7', 's8', 's9', 's10'],
  snaps,
  0.5, 'present',
  'Present in 8/10 (80%) but missed s1 & s2 → 1.0 - 0.5 = 0.5'
);

assertPoints(
  ['s2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10'],
  snaps,
  1.0, 'present',
  'Present in s2 (one of first 2) + 90% → no late penalty → 1.0'
);

assertPoints(
  ['s1', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10'],
  snaps,
  1.0, 'present',
  'Present in s1 (one of first 2) + 90% → no late penalty → 1.0'
);

// ── 3. Presence < 75% (deduct 0.2) ──
console.log('\n3. Presence < 75% (deduct 0.2)');
assertPoints(
  ['s1', 's2', 's3', 's4', 's5', 's6', 's7'],
  snaps,
  0.8, 'present',
  'On time + 7/10 (70%) → 1.0 - 0.2 = 0.8'
);

assertPoints(
  ['s1', 's4', 's5', 's6', 's7', 's8', 's9'],
  snaps,
  0.8, 'present',
  'On time (in s1) + 7/10 (70%) → 0.8'
);

// ── 4. Presence < 50% (deduct 0.3 instead of 0.2) ──
console.log('\n4. Presence < 50% (deduct 0.3)');
assertPoints(
  ['s1', 's2', 's5', 's8'],
  snaps,
  0.7, 'present',
  'On time + 4/10 (40%) → 1.0 - 0.3 = 0.7'
);

// ── 5. Presence < 30% → absent ──
console.log('\n5. Presence < 30% → ABSENT');
assertPoints(
  ['s1', 's5'],
  snaps,
  0, 'absent',
  'On time but 2/10 (20%) → absent, 0 pts'
);

assertPoints(
  ['s3', 's7'],
  snaps,
  0, 'absent',
  'Late + 2/10 (20%) → absent, 0 pts'
);

// ── 6. Combined: Late + low presence ──
console.log('\n6. Combined: Late + Presence Penalties');
assertPoints(
  ['s3', 's4', 's5', 's6', 's7', 's8', 's9'],
  snaps,
  0.3, 'present',
  'Late + 7/10 (70% < 75%) → 1.0 - 0.5 - 0.2 = 0.3'
);

assertPoints(
  ['s3', 's4', 's5', 's8'],
  snaps,
  0.2, 'present',
  'Late + 4/10 (40% < 50%) → 1.0 - 0.5 - 0.3 = 0.2'
);

assertPoints(
  ['s5', 's8'],
  snaps,
  0, 'absent',
  'Late + 2/10 (20% < 30%) → absent, 0 pts'
);

// ── 7. Edge cases ──
console.log('\n7. Edge Cases');
assertPoints(
  [],
  snaps,
  0, 'absent',
  'Not detected at all → absent, 0 pts'
);

assertPoints(
  [],
  [],
  0, 'absent',
  'No snapshots in session → absent, 0 pts'
);

assertPoints(
  ['s1'],
  ['s1'],
  1.0, 'present',
  'Only 1 snapshot in session, student in it → 100% + on time → 1.0'
);

assertPoints(
  ['s1', 's2'],
  ['s1', 's2'],
  1.0, 'present',
  '2 snapshots, student in both → 100% → 1.0'
);

assertPoints(
  ['s2'],
  ['s1', 's2'],
  0.8, 'present',
  '2 snapshots, student in s2 (one of first 2 → on time) + 50% < 75% → 1.0 - 0.2 = 0.8'
);

// ── 8. Boundary values ──
console.log('\n8. Boundary Values');
assertPoints(
  ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'],
  snaps,
  1.0, 'present',
  'On time + 8/10 (80% ≥ 75%) → no deduction → 1.0'
);

assertPoints(
  ['s1', 's2', 's3', 's4', 's5'],
  snaps,
  0.8, 'present',
  'On time + 5/10 (50%) → 50% is NOT <50% so skip -0.3, but <75% → -0.2 → 0.8'
);

// Actually let me recalculate: 5/10 = 50%. <75%? yes → -0.2. <50%? no (50 is not less than 50). So 1.0 - 0.2 = 0.8.
// But the assert above says 0.7 - let me fix:
// Wait, the code does else-if: <30 → absent, else <50 → -0.3, else <75 → -0.2
// 50% is NOT < 50%, so it falls to the <75% check → -0.2 → 0.8

assertPoints(
  ['s1', 's2', 's3'],
  snaps,
  0.7, 'present',
  'On time + 3/10 (30%, exactly threshold) → 30% is NOT <30%, check <50? yes → -0.3 → 0.7'
);

// ── Summary ──
console.log('\n' + '═'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed === 0) {
  console.log('✅ All tests passed!\n');
} else {
  console.log('❌ Some tests failed!\n');
  process.exit(1);
}
