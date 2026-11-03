export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyPassword, signToken } from '@/lib/auth';
import { findCanonicalAccountByLogin } from '@/lib/accounts';
import { defaultCohortForAccount } from '@/lib/cohorts';

export async function POST(req) {
  try {
    // Accept 'identifier' (email or enrollment number) with 'email' as legacy alias
    const body = await req.json();
    const { password } = body;
    const identifier = (body.identifier || body.email || '').trim();

    if (!identifier || !password) {
      return NextResponse.json({ error: 'Email/Enrollment No. and password are required' }, { status: 400 });
    }

    // One global account per person: the password lives in core.accounts, not in any cohort.
    const found = await findCanonicalAccountByLogin(identifier);
    if (!found) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    const { account, aliasAccounts, ctx } = found;

    if (!account.is_active) {
      return NextResponse.json({ error: 'Account is deactivated' }, { status: 403 });
    }

    const supplied = password.trim();
    let valid = await verifyPassword(supplied, account.password_hash);
    // Legacy: people whose last password change happened under an older id (same email) can still log in.
    for (const alias of aliasAccounts) {
      if (valid) break;
      valid = await verifyPassword(supplied, alias.password_hash);
    }
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // The token identifies the PERSON. The cohort is resolved per request from memberships.
    const payload = {
      id: account.id,
      email: account.email,
      role: account.role,
      firstName: account.first_name,
      lastName: account.last_name,
    };
    const token = signToken(payload);
    const defaultCohort = await defaultCohortForAccount(ctx);

    // Return token in JSON body only — client stores it in role-scoped localStorage.
    return NextResponse.json({ token, user: payload, defaultCohort });
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
