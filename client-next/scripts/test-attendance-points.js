/**
 * Unit Tests for Attendance Points System
 * Wi-Fi (first detection 0-5/5-10/10-15 min → 4/3/2) + QR (start 5, end 2).
 * Run: node scripts/test-attendance-points.js
 */

import {
  calculatePoints,
  calculateWifiScore,
  calculateQrPoints,
  resolveAttendanceStatus,
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

const base = { sessionStartAt: sessionStart, sessionEndAt: sessionEnd, finalizeAbsent: true };
const seen = (first, last = first) =>
  calculatePoints({ ...base, firstSeenAt: new Date(first), lastSeenAt: new Date(last), detected: true });

console.log('\n=== Wi-Fi tiers ===');
assert(calculateWifiScore(-3) === 4, 'Before start → 4');
assert(calculateWifiScore(5) === 4, '5 min → 4');
assert(calculateWifiScore(5.1) === 3, '5.1 min → 3');
assert(calculateWifiScore(10) === 3, '10 min → 3');
assert(calculateWifiScore(10.1) === 2, '10.1 min → 2');
assert(calculateWifiScore(15) === 2, '15 min → 2');
assert(calculateWifiScore(15.1) === 0, '15.1 min → 0');

console.log('\n=== QR points ===');
assert(calculateQrPoints(['start']) === 5, 'Start QR → 5');
assert(calculateQrPoints(['end']) === 2, 'End QR → 2');
assert(calculateQrPoints(['start', 'end', 'start']) === 7, 'Both (deduped) → 7');

console.log('\n=== Full scoring ===');
assert(seen('2026-06-01T10:03:00+05:30').points === 4, 'Seen at 3 min → 4');
assert(seen('2026-06-01T10:07:00+05:30').points === 3, 'Seen at 7 min → 3');
assert(seen('2026-06-01T10:12:00+05:30').points === 2, 'Seen at 12 min → 2');
{
  const r = seen('2026-06-01T10:20:00+05:30');
  assert(r.points === 0 && r.status === 'absent', 'Seen at 20 min → 0 pts, absent', `got ${r.points} ${r.status}`);
}
{
  const r = calculatePoints({
    ...base,
    firstSeenAt: new Date('2026-06-01T10:02:00+05:30'),
    lastSeenAt: new Date('2026-06-01T10:03:00+05:30'),
    detected: true,
    qrPhases: ['start', 'end'],
  });
  assert(r.points === 7 && r.status === 'present', 'Start QR + end QR, Wi-Fi ignored → 7', `got ${r.points}`);
}
{
  const r = calculatePoints({ ...base, firstSeenAt: null, lastSeenAt: null, detected: false, qrPhases: ['start'] });
  assert(r.points === 5 && r.status === 'present', 'QR only, no Wi-Fi → 5, present (no penalty)', `got ${r.points} ${r.status}`);
}
{
  const r = calculatePoints({
    ...base,
    firstSeenAt: new Date('2026-06-01T10:02:00+05:30'),
    lastSeenAt: new Date('2026-06-01T10:03:00+05:30'),
    detected: true,
    qrPhases: ['end'],
  });
  assert(r.points === 6, 'No start QR: Wi-Fi 4 + end QR 2 → 6', `got ${r.points}`);
}

console.log('\n=== No-show ===');
{
  const r = calculatePoints({ ...base, firstSeenAt: null, lastSeenAt: null, leaveApproved: true, detected: false });
  assert(r.points === 0 && r.status === 'leave', 'Leave → 0, leave', `got ${r.points} ${r.status}`);
}
{
  const r = calculatePoints({ ...base, firstSeenAt: null, lastSeenAt: null, detected: false });
  assert(r.points === 0 && r.status === 'absent', 'No-show → 0 pts (no penalty), absent', `got ${r.points} ${r.status}`);
}

console.log('\n=== Status ===');
assert(resolveAttendanceStatus({ points: 2, finalizeAbsent: true }) === 'present', 'Positive points → present');
assert(resolveAttendanceStatus({ points: 5, leaveApproved: true, finalizeAbsent: true }) === 'present', 'Positive points beat leave');
assert(resolveAttendanceStatus({ points: 0, detected: true, finalizeAbsent: true }) === 'absent', 'Detected but 0 pts → absent');
assert(resolveAttendanceStatus({ points: 0, detected: true, isOngoing: true }) === 'partial', 'Ongoing + detected → partial');
assert(resolveAttendanceStatus({ points: 0, detected: false, isOngoing: true }) === 'missing', 'Ongoing + not detected → missing');
assert(resolveAttendanceStatus({ points: 5, isOngoing: true }) === 'present', 'Ongoing + QR points → present');

console.log('\n' + '═'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
