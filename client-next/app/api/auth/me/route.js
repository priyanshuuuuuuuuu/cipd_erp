export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getSchemaDb, getCohortConfig } from '@/lib/db';
import { users, students, faculty } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req) {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { schemas } = getCohortConfig();
    let userData = null;
    let targetDb = null;

    for (const schema of (schemas && schemas.length ? schemas : ['july'])) {
      const schemaDb = getSchemaDb(schema);
      const [found] = await schemaDb
        .select({
          id: users.id,
          email: users.email,
          role: users.role,
          first_name: users.firstName,
          last_name: users.lastName,
          is_active: users.isActive,
        })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);

      if (found) {
        userData = found;
        targetDb = schemaDb;
        break;
      }
    }

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let profile = { ...userData };

    // Fetch role-specific data
    if (userData.role === 'student') {
      const [studentData] = await targetDb
        .select({
          enrollment_no: students.enrollmentNo,
          program_name: students.programName,
          mac_address: students.macAddress,
          mac_verified: students.macVerified,
        })
        .from(students)
        .where(eq(students.id, user.id))
        .limit(1);
      if (studentData) profile = { ...profile, ...studentData };
    } else if (userData.role === 'faculty') {
      const [facultyData] = await targetDb
        .select({
          designation: faculty.designation,
          years_experience: faculty.yearsExperience,
          honorarium_rate_per_hour: faculty.honorariumRatePerHour,
        })
        .from(faculty)
        .where(eq(faculty.id, user.id))
        .limit(1);
      if (facultyData) profile = { ...profile, ...facultyData };
    }

    return NextResponse.json({ user: profile });
  } catch (err) {
    console.error('Auth me error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

