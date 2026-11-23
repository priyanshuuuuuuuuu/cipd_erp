import { createHmac, timingSafeEqual } from 'node:crypto';

const INTERVAL_MS = 5000;
// Local development uses a stable code per class and phase to make testing easier.
export const qrRotationIntervalMs = () => process.env.NODE_ENV === 'development' ? null : INTERVAL_MS;
const currentSlot = now => { const interval = qrRotationIntervalMs(); return interval ? Math.floor(now / interval) : 0; };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function signature(secret, schema, sessionId, phase, slot) {
  return createHmac('sha256', secret).update(JSON.stringify(['qr-attendance-v1', schema, sessionId, phase, slot])).digest('base64url');
}

export function makeQrAttendanceToken(secret, schema, sessionId, phase, now = Date.now()) {
  if (!secret || !schema || !uuid.test(sessionId) || !['start', 'end'].includes(phase)) throw new Error('Invalid QR parameters');
  const slot = currentSlot(now);
  return { sessionId, phase, slot, signature: signature(secret, schema, sessionId, phase, slot) };
}

export function verifyQrAttendanceToken(secret, schema, token, now = Date.now()) {
  if (!secret || !schema || !token || !uuid.test(token.sessionId || '') || !['start', 'end'].includes(token.phase) || !Number.isSafeInteger(token.slot) || typeof token.signature !== 'string') return false;
  // Production accepts only the current five-second code. Development keeps one code per phase.
  if (token.slot !== currentSlot(now)) return false;
  const expected = Buffer.from(signature(secret, schema, token.sessionId, token.phase, token.slot));
  const actual = Buffer.from(token.signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
