export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hashPassword, signToken } from '@/lib/auth';

async function generateEnrollmentNo() {
  // Find the highest existing CiPD_ enrollment number
  const { data } = await supabaseAdmin
    .from('students')
    .select('enrollment_no')
    .like('enrollment_no', 'CiPD_%')
    .order('enrollment_no', { ascending: false });

  let maxNum = 0;
  for (const row of data || []) {
    const match = row.enrollment_no?.match(/^CiPD_(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }

  return `CiPD_${maxNum + 1}`;
}

export async function POST(req) {
  try {
    const { firstName, lastName, email, password, programName } = await req.json();

    // Validation
    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json(
        { error: 'First name, last name, email and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // Check if email already exists
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Insert into users table
    const { data: newUser, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        email: email.toLowerCase(),
        password_hash: passwordHash,
        role: 'student',
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        is_active: true,
      })
      .select()
      .single();

    if (userError) {
      console.error('Signup user insert error:', userError);
      return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
    }

    // Auto-generate enrollment number
    const enrollmentNo = await generateEnrollmentNo();

    // Upsert into students table
    const { error: studentError } = await supabaseAdmin
      .from('students')
      .upsert({
        id: newUser.id,
        enrollment_no: enrollmentNo,
        program_name: programName?.trim() || null,
        mac_verified: false,
      }, { onConflict: 'id' });

    if (studentError) {
      console.error('Signup student upsert error:', studentError.message, studentError.details);
      // Rollback user creation
      await supabaseAdmin.from('users').delete().eq('id', newUser.id);
      return NextResponse.json({
        error: `Failed to create student profile: ${studentError.message}`,
      }, { status: 500 });
    }

    // Issue JWT
    const payload = {
      id: newUser.id,
      email: newUser.email,
      role: 'student',
      firstName: newUser.first_name,
      lastName: newUser.last_name,
      enrollmentNo,
    };
    const token = signToken(payload);

    const response = NextResponse.json({ token, user: payload, enrollmentNo }, { status: 201 });
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('Signup error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
