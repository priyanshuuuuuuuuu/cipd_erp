export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

async function handler(req) {
  try {
    const [coursesRes, facultyRes, venuesRes] = await Promise.all([
      supabaseAdmin.from('courses').select('id, name').order('name'),
      supabaseAdmin.from('faculty').select('id, users ( first_name, last_name )').order('id'),
      supabaseAdmin.from('venues').select('id, name, building').order('name'),
    ]);

    return NextResponse.json({
      courses: (coursesRes.data || []).map(c => ({ id: c.id, name: c.name })),
      faculty: (facultyRes.data || []).map(f => ({
        id: f.id,
        name: `${f.users?.first_name || ''} ${f.users?.last_name || ''}`.trim(),
      })),
      venues: (venuesRes.data || []).map(v => ({
        id: v.id,
        name: `${v.name}${v.building ? ', ' + v.building : ''}`,
      })),
    });
  } catch (err) {
    console.error('Lookup error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(handler, ['admin']);
