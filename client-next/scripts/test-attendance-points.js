/**
 * Unit Tests for Attendance Points System
 * Run: node scripts/test-attendance-points.js
 */

import {
  calculatePoints,
  calculateLateEntryBasePoints,
  calculatePingDeduction,
  resolveAttendanceStatus,
  MIN_PRESENCE_PERCENT,
} from '../lib/attendance-points.js';

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

const sessionStart = new Date('2026-06-01T10:00:00+05:30');
const sessionEnd = new Date('2026-06-01T12:00:00+05:30'); // 120 min
const snaps = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10'];

console.log('\n=== Late entry base points ===');
assert(calculateLateEntryBasePoints(0, 120) === 5, 'On time → 5');
assert(calculateLateEntryBasePoints(6, 120) === 5, '6 min → 5');
assert(calculateLateEntryBasePoints(6.2, 120) === 4, '6.2 min → 4');
assert(calculateLateEntryBasePoints(12, 120) === 4, '12 min → 4');
assert(calculateLateEntryBasePoints(15, 120) === 3, '15 min → 3');
assert(calculateLateEntryBasePoints(25, 120) === 2, '25 min → 2');
assert(calculateLateEntryBasePoints(45, 120) === 1, '45 min → 1');
assert(calculateLateEntryBasePoints(70, 120) === 0.5, '70 min (after half) → 0.5');

console.log('\n=== Ping deductions ===');
assert(calculatePingDeduction(85) === 0, '85% → 0');
assert(calculatePingDeduction(75) === 1, '75% → -1');
assert(calculatePingDeduction(50) === 2, '50% → -2');
assert(calculatePingDeduction(30) === 2, '30% → -2');

console.log('\n=== Full scoring ===');
{
  const firstSeen = new Date('2026-06-01T10:05:00+05:30');
  const r = calculatePoints({
    firstSeenAt: firstSeen,
    sessionStartAt: sessionStart,
    sessionEndAt: sessionEnd,
    pingCount: 9,
    orderedSnapshotIds: snaps,
    expectedTotalSnapshots: 10,
    detected: true,
    finalizeAbsent: true,
  });
  assert(r.points === 5, 'On time + 90% pings → 5', `got ${r.points}`);
}

{
  const firstSeen = new Date('2026-06-01T10:15:00+05:30');
  const r = calculatePoints({
    firstSeenAt: firstSeen,
    sessionStartAt: sessionStart,
    sessionEndAt: sessionEnd,
    pingCount: 7,
    orderedSnapshotIds: snaps,
    expectedTotalSnapshots: 10,
    detected: true,
    finalizeAbsent: true,
  });
  assert(r.points === 2, '15 min late + 70% → 3-1=2', `got ${r.points}`);
}

{
  const r = calculatePoints({
    firstSeenAt: null,
    sessionStartAt: sessionStart,
    sessionEndAt: sessionEnd,
    pingCount: 0,
    orderedSnapshotIds: snaps,
    expectedTotalSnapshots: 10,
    leaveApproved: true,
    detected: false,
    finalizeAbsent: true,
  });
  const st = resolveAttendanceStatus({
    presencePercent: 0,
    detected: false,
    leaveApproved: true,
    finalizeAbsent: true,
  });
  assert(r.points === 0 && st === 'leave', 'Leave → 0', `got ${r.points} ${st}`);
}

{
  const r = calculatePoints({
    firstSeenAt: null,
    sessionStartAt: sessionStart,
    sessionEndAt: sessionEnd,
    pingCount: 0,
    orderedSnapshotIds: snaps,
    expectedTotalSnapshots: 10,
    leaveApproved: false,
    detected: false,
    finalizeAbsent: true,
  });
  const st = resolveAttendanceStatus({
    presencePercent: 0,
    detected: false,
    leaveApproved: false,
    finalizeAbsent: true,
    isOngoing: false,
  });
  assert(r.points === -2 && st === 'absent', 'No-show → −2 pts, absent', `got ${r.points} ${st}`);
}

console.log('\n=== Status vs points (separate) ===');
{
  const firstSeen = new Date('2026-06-01T10:05:00+05:30');
  const r = calculatePoints({
    firstSeenAt: firstSeen,
    sessionStartAt: sessionStart,
    sessionEndAt: sessionEnd,
    pingCount: 4,
    orderedSnapshotIds: snaps,
    expectedTotalSnapshots: 10,
    detected: true,
    finalizeAbsent: true,
  });
  const st = resolveAttendanceStatus({
    presencePercent: 40,
    detected: true,
    finalizeAbsent: true,
    isOngoing: false,
  });
  assert(st === 'absent', '40% pings → absent status');
  assert(r.points > 0, '40% pings can still earn points from entry time', `got ${r.points}`);
}

console.log('\n=== Ongoing live status ===');
assert(
  resolveAttendanceStatus({ detected: true, isOngoing: true }) === 'partial',
  'Ongoing + detected → partial (Attending)'
);
assert(
  resolveAttendanceStatus({ detected: false, isOngoing: true }) === 'missing',
  'Ongoing + not detected → missing'
);
assert(MIN_PRESENCE_PERCENT === 45, 'Min presence is 45%');

console.log('\n' + '═'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
