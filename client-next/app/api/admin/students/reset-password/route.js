export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAccountContext } from '@/lib/accounts';
import { withRole } from '@/lib/middleware';
import jwt from 'jsonwebtoken';
import { enqueuePasswordResetEmail } from '@/lib/notification-stream';

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * POST /api/admin/students/reset-password
 * Body: { student_id: string }   (the student's id in the selected cohort)
 *
 * Admin-initiated password reset for the person's ONE account:
 * 1. Resolves the student's global account (they must belong to the selected cohort).
 * 2. Signs a short-lived JWT reset token (15 minutes).
 * 3. Enqueues a password-reset email in the selected cohort's notification outbox.
 *    The notification service resolves APP_URL from its own environment.
 */
async function handler(req) {
  try {
    const { student_id } = await req.json();
    if (!student_id) {
      return NextResponse.json({ error: 'student_id is required.' }, { status: 400 });
    }

    const ctx = await getAccountContext(student_id);
    const inThisCohort = ctx?.memberships.some((m) => m.local_user_id === student_id && m.schema === req.cohort);
    if (!ctx || !inThisCohort) {
      return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
    }
    const { account } = ctx;

    const resetToken = jwt.sign({ user_id: account.id, purpose: 'password_reset' }, JWT_SECRET, { expiresIn: '15m' });

    await enqueuePasswordResetEmail({
      studentId: student_id,
      email: account.email,
      firstName: account.first_name,
      resetToken,
    });

    return NextResponse.json({ success: true, message: `Password reset email sent to ${account.email}` });
  } catch (err) {
    console.error('Admin reset-password error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export const POST = withRole(handler, ['admin']);
