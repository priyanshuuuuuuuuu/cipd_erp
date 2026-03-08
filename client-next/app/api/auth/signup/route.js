import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hashPassword, signToken } from '@/lib/auth';

export async function POST(req) {
  try {
    const { firstName, lastName, email, password, enrollmentNo, programName } = await req.json();

    // Validation — only core fields required
    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json({ error: 'First name, last name, email and password are required' }, { status: 400 });
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

    // Check duplicate enrollment only if provided
    if (enrollmentNo) {
      const { data: existingEnroll } = await supabaseAdmin
        .from('students')
        .select('id')
        .eq('enrollment_no', enrollmentNo.toUpperCase())
        .single();
      if (existingEnroll) {
        return NextResponse.json({ error: 'This enrollment number is already registered' }, { status: 409 });
      }
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

    // Insert into students table
    const studentData = {
      id: newUser.id,
      mac_verified: false,
    };
    if (enrollmentNo) studentData.enrollment_no = enrollmentNo.toUpperCase().trim();
    if (programName) studentData.program_name = programName.trim();

    const { error: studentError } = await supabaseAdmin
      .from('students')
      .insert(studentData);

    if (studentError) {
      console.error('Signup student insert error:', studentError);
      // Rollback user creation
      await supabaseAdmin.from('users').delete().eq('id', newUser.id);
      return NextResponse.json({ error: 'Failed to create student profile' }, { status: 500 });
    }

    // Issue JWT
    const payload = {
      id: newUser.id,
      email: newUser.email,
      role: 'student',
      firstName: newUser.first_name,
      lastName: newUser.last_name,
    };
    const token = signToken(payload);

    const response = NextResponse.json({ token, user: payload }, { status: 201 });
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
