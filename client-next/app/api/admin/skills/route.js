export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { skills, categories } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';

// GET  /api/admin/skills?category_id=xxx  — list skills (optionally filtered by category)
// POST /api/admin/skills                  — create a new skill
async function handler(req) {
  if (req.method === 'GET') {
    try {
      const { searchParams } = new URL(req.url);
      const categoryId = searchParams.get('category_id');

      const rows = await db
        .select({
          id: skills.id,
          name: skills.name,
          details: skills.details,
          category_id: skills.categoryId,
          catId: categories.id,
          catName: categories.name,
          catCourseId: categories.courseId,
        })
        .from(skills)
        .leftJoin(categories, eq(skills.categoryId, categories.id))
        .where(categoryId ? eq(skills.categoryId, categoryId) : undefined)
        .orderBy(skills.name);

      const formatted = rows.map(r => ({
        id: r.id,
        name: r.name,
        details: r.details,
        category_id: r.category_id,
        categories: r.catId ? { id: r.catId, name: r.catName, course_id: r.catCourseId } : null,
      }));

      return NextResponse.json({ skills: formatted });
    } catch (err) {
      console.error('Skills GET error:', err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  if (req.method === 'POST') {
    try {
      const { name, category_id, details } = await req.json();
      if (!name?.trim()) {
        return NextResponse.json({ error: 'Skill name is required' }, { status: 400 });
      }

      const [data] = await db
        .insert(skills)
        .values({
          name: name.trim(),
          categoryId: category_id || null,
          details: details?.trim() || null,
        })
        .returning({
          id: skills.id,
          name: skills.name,
          details: skills.details,
          category_id: skills.categoryId,
        });

      return NextResponse.json({ skill: data }, { status: 201 });
    } catch (err) {
      if (err?.code === '23505' || err?.message?.includes('unique constraint') || err?.cause?.code === '23505') {
        return NextResponse.json({ error: 'A skill with this name already exists' }, { status: 409 });
      }
      console.error('Skills POST error:', err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export const GET  = withRole(handler, ['admin']);
export const POST = withRole(handler, ['admin']);

