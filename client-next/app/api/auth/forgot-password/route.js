export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { connection } from '@/lib/db';
import { qid } from '@/lib/sql-ident';
import { findCanonicalAccountByLogin } from '@/lib/accounts';

// Self-service password reset for FACULTY accounts. Always answers the same way so it cannot be used to discover
// which emails are registered. Limits: 3 requests/hour per email, 10/hour per IP (per process).
const g = globalThis;
if (!g._forgotPwHits) g._forgotPwHits = new Map();

function tooMany(key, max) {
  const now = Date.now();
  const hits = (g._forgotPwHits.get(key) || []).filter((t) => now - t < 3600_000);
  hits.push(now);
  g._forgotPwHits.set(key, hits);
  if (g._forgotPwHits.size > 5000) g._forgotPwHits.clear();
  return hits.length > max;
}

const GENERIC = { message: 'If this email belongs to a faculty account, a password reset link has been sent. Students should contact their coordinator.' };

export async function POST(req) {
  try {
    const { email } = await req.json().catch(() => ({}));
    const addr = String(email || '').trim().toLowerCase();
    if (!addr || !addr.includes('@') || addr.length > 254) return NextResponse.json(GENERIC);

    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
    if (tooMany('ip:' + ip, 10) || tooMany('email:' + addr, 3)) return NextResponse.json(GENERIC);

    const found = await findCanonicalAccountByLogin(addr);
    const account = found?.account;
    if (!account || !account.is_active || account.role !== 'faculty') return NextResponse.json(GENERIC);

    // The outbox lives in a cohort schema: use the faculty member's most recent running cohort.
    const membership = [...found.ctx.memberships].reverse().find((m) => m.cohort_status === 'running');
    if (!membership) return NextResponse.json(GENERIC);

    const resetToken = jwt.sign({ user_id: account.id, purpose: 'password_reset' }, process.env.JWT_SECRET, { expiresIn: '15m' });
    await connection.unsafe(
      `INSERT INTO ${qid(membership.schema)}.notification_stream
         (dedupe_key, event_type, channel, recipient_id, recipient_email, recipient_name, payload, status, available_at)
       VALUES ($1, 'password_reset', 'email', $2, $3, $4, $5::text::jsonb, 'queued', now())
       ON CONFLICT (dedupe_key) DO NOTHING`,
      ['password_reset:' + account.id + ':' + resetToken.slice(-16), membership.local_user_id, account.email, account.first_name || null,
       JSON.stringify({ resetToken })]);

    return NextResponse.json(GENERIC);
  } catch (err) {
    console.error('Forgot password error:', err);
    return NextResponse.json(GENERIC); // never reveal failures either
  }
}
