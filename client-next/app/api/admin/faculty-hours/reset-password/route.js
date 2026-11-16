export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAccountContext } from '@/lib/accounts';
import { withRole } from '@/lib/middleware';
import jwt from 'jsonwebtoken';
import { enqueuePasswordResetEmail } from '@/lib/notification-stream';

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * POST /api/admin/faculty-hours/reset-password
 * Body: { faculty_id: string }   (the faculty member's id in the selected cohort)
 *
 * Admin-initiated password reset for a faculty member's account. Mirrors the student flow:
 * signs a 15-minute reset JWT and enqueues a password-reset email in the selected cohort's
 * notification outbox. The notification service resolves APP_URL from its own environment.
 */
async function handler(req) {
  try {
    const { faculty_id } = await req.json();
    if (!faculty_id) {
      return NextResponse.json({ error: 'faculty_id is required.' }, { status: 400 });
    }

    const ctx = await getAccountContext(faculty_id);
    const inThisCohort = ctx?.memberships.some((m) => m.local_user_id === faculty_id && m.schema === req.cohort);
    if (!ctx || !inThisCohort || ctx.account.role !== 'faculty') {
      return NextResponse.json({ error: 'Faculty member not found.' }, { status: 404 });
    }
    const { account } = ctx;

    const resetToken = jwt.sign({ user_id: account.id, purpose: 'password_reset' }, JWT_SECRET, { expiresIn: '15m' });

    await enqueuePasswordResetEmail({
      studentId: faculty_id,
      email: account.email,
      firstName: account.first_name,
      resetToken,
    });

    return NextResponse.json({ success: true, message: `Password reset email sent to ${account.email}` });
  } catch (err) {
    console.error('Admin faculty reset-password error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export const POST = withRole(handler, ['admin']);
