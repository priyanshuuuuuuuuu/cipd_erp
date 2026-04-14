export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

// GET /api/admin/skills — list all skills
// POST /api/admin/skills — create a new skill
async function handler(req) {
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabaseAdmin
        .from('skills')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return NextResponse.json({ skills: data || [] });
    } catch (err) {
      console.error('Skills GET error:', err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  if (req.method === 'POST') {
    try {
      const { name } = await req.json();
      if (!name?.trim()) {
        return NextResponse.json({ error: 'Skill name is required' }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin
        .from('skills')
        .insert({ name: name.trim() })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return NextResponse.json({ error: 'A skill with this name already exists' }, { status: 409 });
        }
        throw error;
      }

      return NextResponse.json({ skill: data }, { status: 201 });
    } catch (err) {
      console.error('Skills POST error:', err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export const GET  = withRole(handler, ['admin']);
export const POST = withRole(handler, ['admin']);
