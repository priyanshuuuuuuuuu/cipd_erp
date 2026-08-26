export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getSchemaClient, getCohortConfig } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';
import jwt from 'jsonwebtoken';
import { sendPasswordResetEmail } from '@/lib/emailer';

const JWT_SECRET = process.env.JWT_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * POST /api/admin/students/reset-password
 * Body: { student_id: string, schema?: string }
 *
 * Admin-initiated password reset:
 * 1. Looks up the student's email across all schemas (or the given schema).
 * 2. Signs a short-lived JWT reset token (15 minutes).
 * 3. Emails the student a password-reset link.
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

    const resetUrl = `${APP_URL.replace(/\/$/, '')}/reset-password?token=${resetToken}`;

    // Send the email
    await sendPasswordResetEmail({
      to: foundUser.email,
      firstName: foundUser.first_name,
      resetUrl,
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
