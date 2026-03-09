import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';

async function handler(req, { params }) {
  try {
    const { id } = params;

    // 1. Get all session IDs for this course
    const { data: sessions, error: sessErr } = await supabaseAdmin
      .from('sessions')
      .select('id')
      .eq('course_id', id);

    if (sessErr) throw sessErr;

    const sessionIds = (sessions || []).map(s => s.id);

    if (sessionIds.length === 0) {
      return NextResponse.json({ materials: [] });
    }

    // 2. Fetch materials for those sessions
    const { data: materials, error: matErr } = await supabaseAdmin
      .from('session_materials')
      .select(`
        id, title, file_url, file_type, content, created_at,
        sessions ( id, title, session_date ),
        users:uploaded_by ( first_name, last_name )
      `)
      .in('session_id', sessionIds)
      .order('created_at', { ascending: false });

    if (matErr) throw matErr;

    return NextResponse.json({ materials: materials || [] });
  } catch (err) {
    console.error('Course materials error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
