import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';

async function handler(req, { params }) {
  try {
    const { id } = params;

    // Query materials directly by course_id (populated by seed script)
    const { data: materials, error: matErr } = await supabaseAdmin
      .from('session_materials')
      .select(`
        id, title, file_url, file_type, content, created_at,
        sessions ( id, title, session_date ),
        faculty ( id, users ( first_name, last_name ) )
      `)
      .eq('course_id', id)
      .order('created_at', { ascending: false });

    if (matErr) {
      console.error('Course materials query error:', matErr);
      return NextResponse.json({ error: 'Failed to fetch materials', details: matErr.message }, { status: 500 });
    }

    return NextResponse.json({ materials: materials || [] });
  } catch (err) {
    console.error('Course materials error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
