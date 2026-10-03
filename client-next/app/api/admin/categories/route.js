export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { categories } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';

// GET  /api/admin/categories?course_id=xxx  — list categories (optionally filtered by course)
// POST /api/admin/categories                — create a new category
async function handler(req) {
  if (req.method === 'GET') {
    try {
      const { searchParams } = new URL(req.url);
      const courseId = searchParams.get('course_id');

      const categoriesData = await db.query.categories.findMany({
        where: courseId ? eq(categories.courseId, courseId) : undefined,
        with: {
          course: { columns: { name: true } }
        },
        orderBy: (categories, { asc }) => [asc(categories.name)]
      });
      
      const formatted = categoriesData.map(c => ({
        id: c.id,
        name: c.name,
        course_id: c.courseId,
        courses: { name: c.course?.name }
      }));

      return NextResponse.json({ categories: formatted });
    } catch (err) {
      console.error('Categories GET error:', err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  if (req.method === 'POST') {
    try {
      const { name, course_id } = await req.json();
      if (!name?.trim()) {
        return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
      }
      if (!course_id) {
        return NextResponse.json({ error: 'course_id is required' }, { status: 400 });
      }

      try {
        const [newCategory] = await db.insert(categories)
          .values({ name: name.trim(), courseId: course_id })
          .returning({ id: categories.id, name: categories.name, course_id: categories.courseId });

        return NextResponse.json({ category: newCategory }, { status: 201 });
      } catch (insertError) {
        if (insertError.code === '23505') {
          return NextResponse.json({ error: 'Category already exists for this course' }, { status: 409 });
        }
        throw insertError;
      }
    } catch (err) {
      console.error('Categories POST error:', err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export const GET  = withRole(handler, ['admin']);
export const POST = withRole(handler, ['admin']);
