export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getSchemaClient, getCohortConfig } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

/**
 * GET  /api/admin/enrollments?course_id=xxx&schema=july
 * POST /api/admin/enrollments    body: { student_id, course_id, schema? }
 * DELETE /api/admin/enrollments  body: { student_id, course_id, schema? }
 */

function resolveSchemaFromQuery(req) {
  const { searchParams } = new URL(req.url);
  const requested = searchParams.get('schema') || 'july';
  const { schemas } = getCohortConfig();
  return schemas.includes(requested) ? requested : null;
}

function resolveSchemaFromBody(body) {
  const requested = body.schema || 'july';
  const { schemas } = getCohortConfig();
  return schemas.includes(requested) ? requested : null;
}

async function getHandler(req) {
  try {
    const schema = resolveSchemaFromQuery(req);
    if (!schema) return NextResponse.json({ error: 'Invalid schema' }, { status: 400 });
    const db = getSchemaClient(schema);

    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get('course_id');

    let query = db.from('course_enrollments').select(`
      id, enrolled_at, course_id, student_id,
      courses ( id, name ),
      student:student_id ( id, users ( first_name, last_name, email ) )
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
    const body = await req.json();
    const { student_id, course_id } = body;
    const schema = resolveSchemaFromBody(body);
    if (!schema) return NextResponse.json({ error: 'Invalid schema' }, { status: 400 });
    const db = getSchemaClient(schema);

    if (!student_id || !course_id) {
      return NextResponse.json({ error: 'student_id and course_id are required' }, { status: 400 });
    }

    const { data: studentCheck } = await db.from('students').select('id').eq('id', student_id).single();
    if (!studentCheck) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

    const { data: courseCheck } = await db.from('courses').select('id, name').eq('id', course_id).single();
    if (!courseCheck) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

    const { data, error } = await db.from('course_enrollments').insert({ student_id, course_id }).select().single();
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Student is already enrolled in this course' }, { status: 409 });
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
    const body = await req.json();
    const { student_id, course_id } = body;
    const schema = resolveSchemaFromBody(body);
    if (!schema) return NextResponse.json({ error: 'Invalid schema' }, { status: 400 });
    const db = getSchemaClient(schema);

    if (!student_id || !course_id) {
      return NextResponse.json({ error: 'student_id and course_id are required' }, { status: 400 });
    }

    const { error } = await db.from('course_enrollments').delete().eq('student_id', student_id).eq('course_id', course_id);
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
