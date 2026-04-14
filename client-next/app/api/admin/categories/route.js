export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

// GET  /api/admin/categories?course_id=xxx  — list categories (optionally filtered by course)
// POST /api/admin/categories                — create a new category
async function handler(req) {
  if (req.method === 'GET') {
    try {
      const { searchParams } = new URL(req.url);
      const courseId = searchParams.get('course_id');

      let query = supabaseAdmin
        .from('categories')
        .select('id, name, course_id, courses(name)')
        .order('name');

      if (courseId) query = query.eq('course_id', courseId);

      const { data, error } = await query;
      if (error) throw error;

      return NextResponse.json({ categories: data || [] });
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

      const { data, error } = await supabaseAdmin
        .from('categories')
        .insert({ name: name.trim(), course_id })
        .select('id, name, course_id')
        .single();

      if (error) {
        if (error.code === '23505') {
          return NextResponse.json({ error: 'Category already exists for this course' }, { status: 409 });
        }
        throw error;
      }

      return NextResponse.json({ category: data }, { status: 201 });
    } catch (err) {
      console.error('Categories POST error:', err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export const GET  = withRole(handler, ['admin']);
export const POST = withRole(handler, ['admin']);
