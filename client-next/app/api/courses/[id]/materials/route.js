import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';
import { resolveFileUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const BUCKET = 'session-materials';

async function handler(req, { params }) {
  try {
    const { id } = params;

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

    const withUrls = await Promise.all(
      (materials || []).map(async (mat) => ({
        ...mat,
        file_url: mat.file_url ? await resolveFileUrl(BUCKET, mat.file_url) : null,
      }))
    );

    return NextResponse.json({ materials: withUrls });
  } catch (err) {
    console.error('Course materials error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
