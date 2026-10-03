export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { courses, faculty, users, venues, sessionTypes, skills, categories } from '@/drizzle/schema';
import { eq, asc } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';

async function handler(req) {
  try {
    const [coursesList, facultyList, venuesList, typesList, skillsList, categoriesList] = await Promise.all([
      db.select({ id: courses.id, name: courses.name }).from(courses).orderBy(asc(courses.name)),
      
      db.select({
        id: faculty.id,
        years_experience: faculty.yearsExperience,
        first_name: users.firstName,
        last_name: users.lastName,
      })
      .from(faculty)
      .leftJoin(users, eq(faculty.id, users.id))
      .orderBy(asc(faculty.id)),

      db.select({ id: venues.id, name: venues.name, building: venues.building }).from(venues).orderBy(asc(venues.name)),

      db.select({ id: sessionTypes.id, name: sessionTypes.name }).from(sessionTypes).orderBy(asc(sessionTypes.name)),

      db.select({
        id: skills.id,
        name: skills.name,
        details: skills.details,
        category_id: skills.categoryId,
        category_name: categories.name,
      })
      .from(skills)
      .leftJoin(categories, eq(skills.categoryId, categories.id))
      .orderBy(asc(skills.name)),

      db.select({ id: categories.id, name: categories.name, course_id: categories.courseId }).from(categories).orderBy(asc(categories.name)),
    ]);

    return NextResponse.json({
      courses: coursesList.map(c => ({ id: c.id, name: c.name })),
      faculty: facultyList.map(f => ({
        id: f.id,
        name: `${f.first_name || ''} ${f.last_name || ''}`.trim(),
        years_experience: f.years_experience,
      })),
      venues: venuesList.map(v => ({
        id: v.id,
        name: `${v.name}${v.building ? ', ' + v.building : ''}`,
      })),
      sessionTypes: typesList.map(t => ({ id: t.id, name: t.name })),
      skills: skillsList.map(s => ({
        id: s.id,
        name: s.name,
        details: s.details,
        category_id: s.category_id,
        category_name: s.category_name || null,
      })),
      categories: categoriesList.map(c => ({ id: c.id, name: c.name, course_id: c.course_id })),
    });
  } catch (err) {
    console.error('Lookup error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(handler, ['admin']);
