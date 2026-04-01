export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() || '';

    if (!q || q.length < 2) {
      return NextResponse.json({ students: [] });
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, first_name, last_name, email')
      .eq('role', 'student')
      .eq('is_active', true)
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
      .order('first_name')
      .limit(10);

    if (error) throw error;

    return NextResponse.json({ students: data || [] });
  } catch (err) {
    console.error('Student search error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(handler, ['admin']);
