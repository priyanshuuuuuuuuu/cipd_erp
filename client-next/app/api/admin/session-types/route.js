export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

// GET — list all session types
async function getHandler() {
  try {
    const { data, error } = await supabaseAdmin
      .from('session_types')
      .select('id, name')
      .order('name');

    if (error) throw error;
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

    const { data, error } = await supabaseAdmin
      .from('session_types')
      .insert({ name: name.trim() })
      .select('id, name')
      .single();

    if (error) {
      // Unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A type with that name already exists.' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ sessionType: data }, { status: 201 });
  } catch (err) {
    console.error('session-types POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET  = withRole(getHandler,  ['admin']);
export const POST = withRole(postHandler, ['admin']);
