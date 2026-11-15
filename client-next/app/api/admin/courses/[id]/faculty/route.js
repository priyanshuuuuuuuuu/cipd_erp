export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { courseFaculty, courses, faculty, users } from '@/drizzle/schema';
import { eq, inArray } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';

// GET: all faculty of the cohort with an `assigned` flag for this module.
async function getHandler(req, { params }) {
  try {
    const { id } = params;
    const [course] = await db.select({ id: courses.id }).from(courses).where(eq(courses.id, id)).limit(1);
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

    const [all, assigned] = await Promise.all([
      db.select({ id: faculty.id, first_name: users.firstName, last_name: users.lastName, email: users.email, designation: faculty.designation })
        .from(faculty).innerJoin(users, eq(faculty.id, users.id)).where(eq(users.isActive, true)),
      db.select({ id: courseFaculty.facultyId }).from(courseFaculty).where(eq(courseFaculty.courseId, id)),
    ]);
    const set = new Set(assigned.map((a) => a.id));
    return NextResponse.json({
      faculty: all.map((f) => ({ ...f, assigned: set.has(f.id) })).sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)),
    });
  } catch (err) {
    console.error('Course faculty list error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT { faculty_ids: [] } replaces the explicit assignment for this module.
async function putHandler(req, { params }) {
  try {
    const { id } = params;
    const body = await req.json();
    const ids = [...new Set((Array.isArray(body.faculty_ids) ? body.faculty_ids : []).filter((x) => typeof x === 'string'))];

    const [course] = await db.select({ id: courses.id }).from(courses).where(eq(courses.id, id)).limit(1);
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

    if (ids.length) {
      const valid = await db.select({ id: faculty.id }).from(faculty).where(inArray(faculty.id, ids));
      if (valid.length !== ids.length) return NextResponse.json({ error: 'Unknown faculty member in list' }, { status: 400 });
    }

    await db.transaction(async (tx) => {
      await tx.delete(courseFaculty).where(eq(courseFaculty.courseId, id));
      if (ids.length) await tx.insert(courseFaculty).values(ids.map((facultyId) => ({ courseId: id, facultyId })));
    });
    return NextResponse.json({ success: true, count: ids.length });
  } catch (err) {
    console.error('Course faculty save error:', err);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}

export const GET = withRole(getHandler, ['admin']);
export const PUT = withRole(putHandler, ['admin']);
