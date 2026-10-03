export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, students } from '@/drizzle/schema';
import { eq, like, desc } from 'drizzle-orm';
import { hashPassword, signToken } from '@/lib/auth';

async function generateEnrollmentNo() {
  // Find the highest existing CiPD_ enrollment number
  const rows = await db
    .select({ enrollment_no: students.enrollmentNo })
    .from(students)
    .where(like(students.enrollmentNo, 'CiPD_%'))
    .orderBy(desc(students.enrollmentNo));

  let maxNum = 0;
  for (const row of rows || []) {
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
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Insert into users table
    const [newUser] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        passwordHash,
        role: 'student',
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        isActive: true,
      })
      .returning();

    if (!newUser) {
      return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
    }

    // Auto-generate enrollment number
    const enrollmentNo = await generateEnrollmentNo();

    // Upsert into students table
    try {
      await db
        .insert(students)
        .values({
          id: newUser.id,
          enrollmentNo,
          programName: programName?.trim() || null,
          macVerified: false,
        })
        .onConflictDoUpdate({
          target: students.id,
          set: {
            enrollmentNo,
            programName: programName?.trim() || null,
            macVerified: false,
          },
        });
    } catch (studentError) {
      console.error('Signup student upsert error:', studentError);
      // Rollback user creation
      await db.delete(users).where(eq(users.id, newUser.id));
      return NextResponse.json({
        error: `Failed to create student profile: ${studentError.message}`,
      }, { status: 500 });
    }

    // Issue JWT
    const payload = {
      id: newUser.id,
      email: newUser.email,
      role: 'student',
      firstName: newUser.firstName,
      lastName: newUser.lastName,
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

