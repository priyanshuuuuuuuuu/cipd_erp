export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db as defaultDb, getSchemaDb, getCohortConfig } from '@/lib/db';
import { users, students } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { withAuth } from '@/lib/middleware';

// Never cache this route — mac_verified can change at any time via admin approval
const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'Pragma': 'no-cache',
};

async function handler(req) {
  try {
    let db = defaultDb;
    let userFound = false;

    if (req.user?.schema) {
      db = getSchemaDb(req.user.schema);
      const [u] = await db
        .select({ id: users.id, email: users.email, first_name: users.firstName, last_name: users.lastName, role: users.role, is_active: users.isActive })
        .from(users).where(eq(users.id, req.user.id));
      if (u) userFound = u;
    } else {
      const { schemas } = getCohortConfig();
      for (const s of (schemas && schemas.length ? schemas : ['july'])) {
        const schemaDb = getSchemaDb(s);
        const [u] = await schemaDb
          .select({ id: users.id, email: users.email, first_name: users.firstName, last_name: users.lastName, role: users.role, is_active: users.isActive })
          .from(users).where(eq(users.id, req.user.id));
        if (u) {
          userFound = u;
          db = schemaDb;
          break;
        }
      }
    }

    if (!userFound) {
      return NextResponse.json({ error: 'User not found' }, { status: 404, headers: NO_CACHE_HEADERS });
    }
    const user = userFound;

    const [student] = await db
      .select({
        enrollment_no: students.enrollmentNo,
        program_name: students.programName,
        mac_address: students.macAddress,
        mac_verified: students.macVerified,
        device_hash: students.deviceHash,
      })
      .from(students)
      .where(eq(students.id, req.user.id));

    if (!student) {
      return NextResponse.json({ error: 'Student profile not found' }, { status: 404, headers: NO_CACHE_HEADERS });
    }

    return NextResponse.json(
      { profile: { ...user, ...student } },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err) {
    console.error('Student profile error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

export const GET = withAuth(handler);
