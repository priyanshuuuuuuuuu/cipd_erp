export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/drizzle/schema';
import { eq, and, ilike, or } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';

async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() || '';

    if (!q || q.length < 2) {
      return NextResponse.json({ students: [] });
    }

    const data = await db
      .select({
        id: users.id,
        first_name: users.firstName,
        last_name: users.lastName,
        email: users.email,
      })
      .from(users)
      .where(
        and(
          eq(users.role, 'student'),
          eq(users.isActive, true),
          or(
            ilike(users.firstName, `%${q}%`),
            ilike(users.lastName, `%${q}%`),
            ilike(users.email, `%${q}%`)
          )
        )
      )
      .orderBy(users.firstName)
      .limit(10);

    return NextResponse.json({ students: data || [] });
  } catch (err) {
    console.error('Student search error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(handler, ['admin']);

