export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { connection, getCohortConfig } from '@/lib/db';
import { hashPassword, signToken } from '@/lib/auth';
import { createStudent } from '@/lib/student-service';
import { errorResponse } from '@/lib/sql-ident';

/** Next free CiPD_<n> across all accounts (enrollment numbers are unique per person, not per cohort). */
async function generateEnrollmentNo() {
  const rows = await connection`SELECT enrollment_no FROM core.accounts WHERE enrollment_no ~ '^CiPD_[0-9]+$'`;
  let maxNum = 0;
  for (const row of rows) {
    const n = parseInt(row.enrollment_no.slice(5), 10);
    if (n > maxNum) maxNum = n;
  }
  return `CiPD_${maxNum + 1}`;
}

// New self-service signups join the default (running) cohort.
export async function POST(req) {
  try {
    const { firstName, lastName, email, password, programName } = await req.json();

    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json({ error: 'First name, last name, email and password are required' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const { cohorts, active } = await getCohortConfig();
    const cohort = cohorts.find((c) => c.schema === active && c.status === 'running');
    if (!cohort) return NextResponse.json({ error: 'Sign-up is closed: there is no running cohort.' }, { status: 503 });

    const normalizedEmail = email.trim().toLowerCase();
    const [existing] = await connection`SELECT 1 AS x FROM core.accounts WHERE lower(email) = ${normalizedEmail}`;
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    const enrollmentNo = await generateEnrollmentNo();
    let programId = null;
    if (programName?.trim()) {
      const [p] = await connection`SELECT id FROM core.programs WHERE lower(name) = ${programName.trim().toLowerCase()}`;
      programId = p?.id ?? null;
    }

    const { student } = await createStudent({
      cohortId: cohort.id,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      enrollmentNo,
      programId,
      passwordHash: await hashPassword(password),
    }, { sendEmail: false });

    const payload = {
      id: student.id,
      email: student.email,
      role: 'student',
      firstName: student.first_name,
      lastName: student.last_name,
      enrollmentNo,
    };
    const token = signToken(payload);

    const response = NextResponse.json({ token, user: payload, enrollmentNo, defaultCohort: cohort.schema }, { status: 201 });
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });
    return response;
  } catch (err) {
    return errorResponse(NextResponse, err, 'Signup error');
  }
}
