import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';

async function handler(req) {
  try {
    const { data: user, error: userErr } = await supabaseAdmin
      .from('users')
      .select('id, email, first_name, last_name, role, is_active')
      .eq('id', req.user.id)
      .single();

    if (userErr || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { data: student, error: studentErr } = await supabaseAdmin
      .from('students')
      .select('enrollment_no, program_name, mac_address, mac_verified, device_hash')
      .eq('id', req.user.id)
      .single();

    if (studentErr || !student) {
      return NextResponse.json({ error: 'Student profile not found' }, { status: 404 });
    }

    return NextResponse.json({
      profile: {
        ...user,
        ...student,
      },
    });
  } catch (err) {
    console.error('Student profile error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
