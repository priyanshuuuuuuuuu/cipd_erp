export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getSchemaDb, getCohortConfig } from '@/lib/db';
import { users } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { hashPassword } from '@/lib/auth';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * POST /api/auth/reset-password
 * Body: { token: string, newPassword: string }
 *
 * Validates the JWT reset token (issued by admin) and updates the password.
 * No authentication required — the token itself is the credential.
 */
export async function POST(req) {
  try {
    const { token, newPassword } = await req.json();

    if (!token || !newPassword) {
      return NextResponse.json(
        { error: 'token and newPassword are required.' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters.' },
        { status: 400 }
      );
    }

    // Verify the token
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

    // Ensure it's a password-reset token
    if (payload.purpose !== 'password_reset' || !payload.user_id) {
      return NextResponse.json({ error: 'Invalid reset token.' }, { status: 401 });
    }

    const userId = payload.user_id;

    // Find the user across all schemas
    const { schemas } = await getCohortConfig();
    let found = false;

    for (const schema of schemas) {
      const schemaDb = getSchemaDb(schema);
      const [user] = await schemaDb
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user) {
        const newHash = await hashPassword(newPassword);
        await schemaDb
          .update(users)
          .set({ passwordHash: newHash })
          .where(eq(users.id, userId));

        found = true;
        break;
      }
    }

    if (!found) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Password updated successfully. You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

