export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { setPassword } from '@/lib/accounts';

// Account-level: changes the person's one password (core.accounts) and works on archived cohorts too.
async function handler(req) {
  try {
    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'currentPassword and newPassword are required' }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
    }

    const hash = req.account.password_hash;
    if (!(await verifyPassword(currentPassword, hash))) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    }
    if (await verifyPassword(newPassword, hash)) {
      return NextResponse.json({ error: 'New password must be different from current password' }, { status: 400 });
    }

    await setPassword(req.user.accountId, await hashPassword(newPassword));
    return NextResponse.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Update password error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withAuth(handler, { allowArchivedWrites: true });
