export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getSchemaDb } from '@/lib/db';
import { students, faculty } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { withAuth } from '@/lib/middleware';

// Identity comes from core.accounts (via withAuth); role-specific profile data from the request's cohort.
async function handler(req) {
  try {
    const schemaDb = getSchemaDb(req.cohort);
    const a = req.account;
    let profile = {
      id: req.user.accountId,
      email: a.email,
      role: a.role,
      first_name: a.first_name,
      last_name: a.last_name,
      is_active: a.is_active,
    };

    if (a.role === 'student') {
      const [studentData] = await schemaDb
        .select({
          enrollment_no: students.enrollmentNo,
          program_name: students.programName,
          mac_address: students.macAddress,
          mac_verified: students.macVerified,
        })
        .from(students)
        .where(eq(students.id, req.user.id))
        .limit(1);
      if (studentData) profile = { ...profile, ...studentData };
    } else if (a.role === 'faculty') {
      const [facultyData] = await schemaDb
        .select({
          designation: faculty.designation,
          years_experience: faculty.yearsExperience,
          honorarium_rate_per_hour: faculty.honorariumRatePerHour,
        })
        .from(faculty)
        .where(eq(faculty.id, req.user.id))
        .limit(1);
      if (facultyData) profile = { ...profile, ...facultyData };
    }

    return NextResponse.json({
      user: { ...profile, cohort: req.cohort, cohort_status: req.cohortInfo.status, membership_status: req.membership?.status ?? null },
    });
  } catch (err) {
    console.error('Auth me error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
