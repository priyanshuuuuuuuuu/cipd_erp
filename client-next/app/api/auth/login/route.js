export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyPassword, signToken } from '@/lib/auth';

export async function POST(req) {
  try {
    // Accept 'identifier' (email or enrollment number) with 'email' as legacy alias
    const body = await req.json();
    const { password } = body;
    const identifier = (body.identifier || body.email || '').trim();

    if (!identifier || !password) {
      return NextResponse.json({ error: 'Email/Enrollment No. and password are required' }, { status: 400 });
    }

    let user = null;

    const isEmail = identifier.includes('@');

    if (isEmail) {
      // ── Path 1: Email login (all roles) ──────────────────────────────────
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('email', identifier.toLowerCase())
        .single();

      if (!error && data) user = data;
    } else {
      // ── Path 2: Enrollment number login (students only) ───────────────────
      // JOIN students onto users where students.enrollment_no matches identifier.
      // students.id is a FK → users.id, so we embed the users row via a relation.
      const { data, error } = await supabaseAdmin
        .from('students')
        .select('id, enrollment_no, users!inner(id, email, password_hash, role, first_name, last_name, is_active, preferences)')
        .eq('enrollment_no', identifier)
        .single();

      if (!error && data?.users) {
        // Flatten: merge the nested users row into a single object
        user = { ...data.users };
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (!user.is_active) {
      return NextResponse.json({ error: 'Account is deactivated' }, { status: 403 });
    }

    // Verify password
    const valid = await verifyPassword(password.trim(), user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Build token payload
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
    };

    const token = signToken(payload);

    // Return token in JSON body only — client stores it in role-scoped localStorage.
    // We intentionally do NOT set a shared 'token' cookie because multiple roles
    // (student + admin) may be open in the same browser, and a shared cookie would
    // cause the server to identify API calls as the wrong user.
    return NextResponse.json({ token, user: payload });
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
