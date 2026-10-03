export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessionTypes } from '@/drizzle/schema';
import { asc } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';

// GET — list all session types
async function getHandler() {
  try {
    const data = await db
      .select({ id: sessionTypes.id, name: sessionTypes.name })
      .from(sessionTypes)
      .orderBy(asc(sessionTypes.name));

    return NextResponse.json({ sessionTypes: data || [] });
  } catch (err) {
    console.error('session-types GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — add a new session type
async function postHandler(req) {
  try {
    const { name } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Type name is required.' }, { status: 400 });
    }

    try {
      const [inserted] = await db
        .insert(sessionTypes)
        .values({ name: name.trim() })
        .returning({ id: sessionTypes.id, name: sessionTypes.name });

      return NextResponse.json({ sessionType: inserted }, { status: 201 });
    } catch (dbErr) {
      if (dbErr.code === '23505' || dbErr.message?.includes('unique constraint') || dbErr.message?.includes('duplicate key')) {
        return NextResponse.json({ error: 'A type with that name already exists.' }, { status: 409 });
      }
      throw dbErr;
    }
  } catch (err) {
    console.error('session-types POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET  = withRole(getHandler,  ['admin']);
export const POST = withRole(postHandler, ['admin']);
