export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';

async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const department = searchParams.get('department');

    let query = supabaseAdmin
      .from('faculty')
      .select(`
        id, designation, years_experience, honorarium_rate_per_hour,
        users ( id, email, first_name, last_name, is_active )
      `);

    const { data: facultyList, error } = await query;

    if (error) {
      console.error('Faculty list error:', error);
      return NextResponse.json({ error: 'Failed to fetch faculty' }, { status: 500 });
    }

    // Flatten the data
    const faculty = (facultyList || []).map(f => ({
      id: f.id,
      first_name: f.users?.first_name,
      last_name: f.users?.last_name,
      email: f.users?.email,
      is_active: f.users?.is_active,
      designation: f.designation,
      years_experience: f.years_experience,
      honorarium_rate_per_hour: f.honorarium_rate_per_hour,
    }));

    return NextResponse.json({ faculty });
  } catch (err) {
    console.error('Faculty error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
