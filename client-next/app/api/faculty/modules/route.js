export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { courses, courseEnrollments, coursePosts } from '@/drizzle/schema';
import { count, inArray, max } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';
import { getFacultyCourseIds } from '@/lib/faculty-access';

// The faculty member's modules (assigned by admin, or any module they have a session in).
async function handler(req) {
  try {
    const ids = await getFacultyCourseIds(req.user.id);
    if (!ids.length) return NextResponse.json({ modules: [] });

    const [rows, students, posts] = await Promise.all([
      db.select({ id: courses.id, name: courses.name, code: courses.code, description: courses.description })
        .from(courses).where(inArray(courses.id, ids)).orderBy(courses.name),
      db.select({ course_id: courseEnrollments.courseId, n: count() }).from(courseEnrollments)
        .where(inArray(courseEnrollments.courseId, ids)).groupBy(courseEnrollments.courseId),
      db.select({ course_id: coursePosts.courseId, n: count(), last: max(coursePosts.createdAt) }).from(coursePosts)
        .where(inArray(coursePosts.courseId, ids)).groupBy(coursePosts.courseId),
    ]);
    const sMap = Object.fromEntries(students.map((s) => [s.course_id, Number(s.n)]));
    const pMap = Object.fromEntries(posts.map((p) => [p.course_id, p]));

    return NextResponse.json({
      modules: rows.map((c) => ({
        ...c,
        student_count: sMap[c.id] || 0,
        post_count: Number(pMap[c.id]?.n || 0),
        last_post_at: pMap[c.id]?.last || null,
      })),
    });
  } catch (err) {
    console.error('Faculty modules error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(handler, ['faculty']);
