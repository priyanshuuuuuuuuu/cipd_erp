export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { faculty, users } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { withAuth } from '@/lib/middleware';

async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const department = searchParams.get('department');

    const facultyList = await db
      .select({
        id: faculty.id,
        designation: faculty.designation,
        department: faculty.department,
        photo_url: faculty.photoUrl,
        years_experience: faculty.yearsExperience,
        honorarium_rate_per_hour: faculty.honorariumRatePerHour,
        first_name: users.firstName,
        last_name: users.lastName,
        email: users.email,
        is_active: users.isActive,
      })
      .from(faculty)
      .leftJoin(users, eq(faculty.id, users.id));

    // Flatten the data
    const formatted = (facultyList || []).map(f => ({
      id: f.id,
      first_name: f.first_name,
      last_name: f.last_name,
      email: f.email,
      is_active: f.is_active,
      designation: f.designation,
      department: f.department || null,
      photo_url: f.photo_url || null,
      years_experience: f.years_experience,
      honorarium_rate_per_hour: f.honorarium_rate_per_hour,
    }));

    return NextResponse.json({ faculty: formatted });
  } catch (err) {
    console.error('Faculty error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);

