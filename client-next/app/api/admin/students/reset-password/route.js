export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getSchemaClient, getCohortConfig } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';
import jwt from 'jsonwebtoken';
import { enqueuePasswordResetEmail } from '@/lib/notification-stream';

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * POST /api/admin/students/reset-password
 * Body: { student_id: string, schema?: string }
 *
 * Admin-initiated password reset:
 * 1. Looks up the student's email across all schemas (or the given schema).
 * 2. Signs a short-lived JWT reset token (15 minutes).
 * 3. Enqueues a password-reset email via the notification stream outbox.
 *    The notification service resolves APP_URL from its own environment,
 *    so the reset link is always the production URL — never localhost.
 */
async function handler(req) {
  try {
    const body = await req.json();
    const { student_id, schema } = body;

    if (!student_id) {
      return NextResponse.json({ error: 'student_id is required.' }, { status: 400 });
    }

    // Resolve which schemas to search
    const { schemas } = getCohortConfig();
    const searchSchemas = schema && schemas.includes(schema) ? [schema] : schemas;

    // Find the user across schemas
    let foundUser = null;
    for (const s of searchSchemas) {
      const db = getSchemaClient(s);
      const { data } = await db
        .from('users')
        .select('id, email, first_name, last_name')
        .eq('id', student_id)
        .maybeSingle();

      if (data) {
        foundUser = data;
        break;
      }
    }

    if (!foundUser) {
      return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
    }

    // Create a signed reset token valid for 15 minutes
    const resetToken = jwt.sign(
      { user_id: foundUser.id, purpose: 'password_reset' },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Enqueue via the notification service outbox (handles APP_URL + retries)
    await enqueuePasswordResetEmail({
      studentId: foundUser.id,
      email: foundUser.email,
      firstName: foundUser.first_name,
      resetToken,
    });

    return NextResponse.json({
      success: true,
      message: `Password reset email sent to ${foundUser.email}`,
    });
  } catch (err) {
    console.error('Admin reset-password error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export const POST = withRole(handler, ['admin']);
