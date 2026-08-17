/**
 * Unit Tests for Attendance Points System
 * Run: node scripts/test-attendance-points.js
 */

import {
  calculatePoints,
  calculateArrivalBonus,
  calculateDurationScore,
  resolveAttendanceStatus,
  MIN_DURATION_PERCENT,
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

console.log('\n=== Arrival bonus ===');
assert(calculateArrivalBonus(0) === 1, 'On time → +1');
assert(calculateArrivalBonus(6) === 1, '6 min → +1');
assert(calculateArrivalBonus(6.2) === 0, '6.2 min → +0');
assert(calculateArrivalBonus(15) === 0, '15 min → +0');

console.log('\n=== Duration score ===');
assert(calculateDurationScore(85) === 4, '85% → 4');
assert(calculateDurationScore(75) === 3, '75% → 3');
assert(calculateDurationScore(65) === 2, '65% → 2');
assert(calculateDurationScore(55) === 1, '55% → 1');
assert(calculateDurationScore(30) === 0.5, '30% → 0.5');

console.log('\n=== Full scoring ===');
{
  const firstSeen = new Date('2026-06-01T10:05:00+05:30'); // 5 mins late -> +1 arrival
  const lastSeen = new Date('2026-06-01T11:55:00+05:30'); // 110 mins duration -> 91% -> +4
  const r = calculatePoints({
    firstSeenAt: firstSeen,
    lastSeenAt: lastSeen,
    sessionStartAt: sessionStart,
    sessionEndAt: sessionEnd,
    detected: true,
    finalizeAbsent: true,
  });
  assert(r.points === 5, 'On time + 91% duration → 5', `got ${r.points}`);
}

{
  const firstSeen = new Date('2026-06-01T10:15:00+05:30'); // 15 min late -> 0 arrival
  const lastSeen = new Date('2026-06-01T11:45:00+05:30'); // 90 min duration -> 75% -> +3
  const r = calculatePoints({
    firstSeenAt: firstSeen,
    lastSeenAt: lastSeen,
    sessionStartAt: sessionStart,
    sessionEndAt: sessionEnd,
    detected: true,
    finalizeAbsent: true,
  });
  assert(r.points === 3, '15 min late + 75% duration → 3', `got ${r.points}`);
}

{
  const r = calculatePoints({
    firstSeenAt: null,
    lastSeenAt: null,
    sessionStartAt: sessionStart,
    sessionEndAt: sessionEnd,
    leaveApproved: true,
    detected: false,
    finalizeAbsent: true,
  });
  const st = resolveAttendanceStatus({
    durationPercent: 0,
    detected: false,
    leaveApproved: true,
    finalizeAbsent: true,
  });
  assert(r.points === 0 && st === 'leave', 'Leave → 0', `got ${r.points} ${st}`);
}

{
  const r = calculatePoints({
    firstSeenAt: null,
    lastSeenAt: null,
    sessionStartAt: sessionStart,
    sessionEndAt: sessionEnd,
    leaveApproved: false,
    detected: false,
    finalizeAbsent: true,
  });
  const st = resolveAttendanceStatus({
    durationPercent: 0,
    detected: false,
    leaveApproved: false,
    finalizeAbsent: true,
    isOngoing: false,
  });
  assert(r.points === -2 && st === 'absent', 'No-show → −2 pts, absent', `got ${r.points} ${st}`);
}

console.log('\n=== Status vs points (separate) ===');
{
  const firstSeen = new Date('2026-06-01T10:05:00+05:30'); // arrival +1
  const lastSeen = new Date('2026-06-01T10:29:00+05:30'); // duration 24 min = 20% -> +0.5
  const r = calculatePoints({
    firstSeenAt: firstSeen,
    lastSeenAt: lastSeen,
    sessionStartAt: sessionStart,
    sessionEndAt: sessionEnd,
    detected: true,
    finalizeAbsent: true,
  });
  const st = resolveAttendanceStatus({
    durationPercent: 20, // less than 25
    detected: true,
    finalizeAbsent: true,
    isOngoing: false,
  });
  assert(st === 'absent', '20% duration → absent status');
  assert(r.points === 1.5, '20% duration earns 1.5 pts', `got ${r.points}`);
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
assert(MIN_DURATION_PERCENT === 25, 'Min duration is 25%');

console.log('\n' + '═'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
