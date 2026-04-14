export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

/**
 * GET /api/admin/enrollments?course_id=xxx
 * Returns all students enrolled in a given course (or all enrollments if no course_id).
 *
 * POST /api/admin/enrollments
 * Enrolls a student in a course.
 * Body: { student_id, course_id }
 *
 * DELETE /api/admin/enrollments
 * Removes a student from a course.
 * Body: { student_id, course_id }
 */

async function getHandler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get('course_id');

    let query = supabaseAdmin
      .from('course_enrollments')
      .select(`
        id,
        enrolled_at,
        course_id,
        student_id,
        courses ( id, name ),
        student:student_id (
          id,
          users ( first_name, last_name, email )
        )
      `);

    if (courseId) query = query.eq('course_id', courseId);

    const { data, error } = await query.order('enrolled_at', { ascending: false });
    if (error) throw error;

    return NextResponse.json({ enrollments: data || [] });
  } catch (err) {
    console.error('Enrollments GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function postHandler(req) {
  try {
    const { student_id, course_id } = await req.json();

    if (!student_id || !course_id) {
      return NextResponse.json({ error: 'student_id and course_id are required' }, { status: 400 });
    }

    // Verify the student exists in the students table
    const { data: studentCheck } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('id', student_id)
      .single();

    if (!studentCheck) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Verify the course exists
    const { data: courseCheck } = await supabaseAdmin
      .from('courses')
      .select('id, name')
      .eq('id', course_id)
      .single();

    if (!courseCheck) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Insert enrollment (ignore conflict if already enrolled)
    const { data, error } = await supabaseAdmin
      .from('course_enrollments')
      .insert({ student_id, course_id })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Student is already enrolled in this course' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ enrollment: data, message: `Student enrolled in ${courseCheck.name}` }, { status: 201 });
  } catch (err) {
    console.error('Enrollment POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function deleteHandler(req) {
  try {
    const { student_id, course_id } = await req.json();

    if (!student_id || !course_id) {
      return NextResponse.json({ error: 'student_id and course_id are required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('course_enrollments')
      .delete()
      .eq('student_id', student_id)
      .eq('course_id', course_id);

    if (error) throw error;

    return NextResponse.json({ message: 'Student unenrolled successfully' });
  } catch (err) {
    console.error('Enrollment DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(getHandler, ['admin']);
export const POST = withRole(postHandler, ['admin']);
export const DELETE = withRole(deleteHandler, ['admin']);
