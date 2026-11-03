export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth';
import { getAccountContext, setPassword } from '@/lib/accounts';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * POST /api/auth/reset-password
 * Body: { token: string, newPassword: string }
 *
 * Validates the JWT reset token (issued by an admin or at student creation) and sets the person's ONE password
 * in core.accounts. The token's user_id may be any of the person's ids (cohort-local or canonical).
 * No authentication required — the token itself is the credential.
 */
export async function POST(req) {
  try {
    const { token, newPassword } = await req.json();

    if (!token || !newPassword) {
      return NextResponse.json({ error: 'token and newPassword are required.' }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      const isExpired = err.name === 'TokenExpiredError';
      return NextResponse.json(
        { error: isExpired ? 'This reset link has expired. Please ask your admin to send a new one.' : 'Invalid reset link.' },
        { status: 401 }
      );
    }

    if (payload.purpose !== 'password_reset' || !payload.user_id) {
      return NextResponse.json({ error: 'Invalid reset token.' }, { status: 401 });
    }

    const ctx = await getAccountContext(payload.user_id);
    if (!ctx) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    await setPassword(ctx.canonicalId, await hashPassword(newPassword));
    return NextResponse.json({ success: true, message: 'Password updated successfully. You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
