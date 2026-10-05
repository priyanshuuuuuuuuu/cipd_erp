export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getSchemaDb, getCohortConfig } from '@/lib/db';
import { users, students } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { verifyPassword, signToken } from '@/lib/auth';
import { DEFAULT_SCHEMA } from '@/config';
import { pickDefaultCohort } from '@/lib/cohorts';

export async function POST(req) {
  try {
    // Accept 'identifier' (email or enrollment number) with 'email' as legacy alias
    const body = await req.json();
    const { password } = body;
    const identifier = (body.identifier || body.email || '').trim();

    if (!identifier || !password) {
      return NextResponse.json({ error: 'Email/Enrollment No. and password are required' }, { status: 400 });
    }

    const { schemas, active } = await getCohortConfig();

    let user = null;
    let matchedSchema = null;
    const matches = []; // { schema, found } for every cohort the user belongs to
    const isEmail = identifier.includes('@');

    for (const schema of (schemas && schemas.length ? schemas : [DEFAULT_SCHEMA])) {
      const schemaDb = getSchemaDb(schema);

      if (isEmail) {
        // ── Path 1: Email login (all roles) ──────────────────────────────────
        const [found] = await schemaDb
          .select()
          .from(users)
          .where(eq(users.email, identifier.toLowerCase()))
          .limit(1);

        if (found) matches.push({ schema, found });
      } else {
        // ── Path 2: Enrollment number login (students only) ───────────────────
        const [found] = await schemaDb
          .select({
            id: users.id,
            email: users.email,
            passwordHash: users.passwordHash,
            role: users.role,
            firstName: users.firstName,
            lastName: users.lastName,
            isActive: users.isActive,
            preferences: users.preferences,
          })
          .from(students)
          .innerJoin(users, eq(students.id, users.id))
          .where(eq(students.enrollmentNo, identifier))
          .limit(1);

        if (found) matches.push({ schema, found });
      }
    }

    if (matches.length) {
      const chosen = pickDefaultCohort(
        matches[0].found.role,
        matches.map(m => m.schema),
        active,
      );
      const match = matches.find(m => m.schema === chosen) || matches[0];
      user = match.found;
      matchedSchema = match.schema;
    }

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const isActive = user.isActive ?? user.is_active;
    if (!isActive) {
      return NextResponse.json({ error: 'Account is deactivated' }, { status: 403 });
    }

    // Verify password
    const passwordHash = user.passwordHash || user.password_hash;
    const valid = await verifyPassword(password.trim(), passwordHash);

    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Build token payload
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName ?? user.first_name,
      lastName: user.lastName ?? user.last_name,
      schema: matchedSchema,
    };

    const token = signToken(payload);

    // Return token in JSON body only — client stores it in role-scoped localStorage.
    return NextResponse.json({ token, user: payload });
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

