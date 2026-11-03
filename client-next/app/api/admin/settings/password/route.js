import { NextResponse } from 'next/server';
import { withRole } from '@/lib/middleware';
import { verifyPassword, hashPassword } from '@/lib/auth';
import { setPassword } from '@/lib/accounts';

async function handler(req) {
  try {
    if (req.method === 'POST') {
      const { currentPassword, newPassword } = await req.json();

      if (!currentPassword || !newPassword) {
        return NextResponse.json({ error: 'Missing password fields' }, { status: 400 });
      }
      if (newPassword.length < 8) {
        return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
      }

      if (!(await verifyPassword(currentPassword, req.account.password_hash))) {
        return NextResponse.json({ error: 'Invalid current password' }, { status: 401 });
      }

      await setPassword(req.user.accountId, await hashPassword(newPassword));
      return NextResponse.json({ success: true, message: 'Password updated successfully' });
    }

    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  } catch (err) {
    console.error('Password reset API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withRole(handler, ['admin'], { allowArchivedWrites: true });
