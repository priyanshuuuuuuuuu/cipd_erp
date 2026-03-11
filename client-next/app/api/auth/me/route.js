export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req) {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch full user data based on role
    const { data: userData, error } = await supabaseAdmin
      .from('users')
      .select('id, email, role, first_name, last_name, is_active')
      .eq('id', user.id)
      .single();

    if (error || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let profile = { ...userData };

    // Fetch role-specific data
    if (userData.role === 'student') {
      const { data: student } = await supabaseAdmin
        .from('students')
        .select('enrollment_no, program_name, mac_address, mac_verified')
        .eq('id', user.id)
        .single();
      if (student) profile = { ...profile, ...student };
    } else if (userData.role === 'faculty') {
      const { data: faculty } = await supabaseAdmin
        .from('faculty')
        .select('designation, years_experience, honorarium_rate_per_hour')
        .eq('id', user.id)
        .single();
      if (faculty) profile = { ...profile, ...faculty };
    }

    return NextResponse.json({ user: profile });
  } catch (err) {
    console.error('Auth me error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
