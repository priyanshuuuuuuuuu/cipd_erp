export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getSchemaDb, getCohortConfig } from '@/lib/db';
import { courseEnrollments, students, courses } from '@/drizzle/schema';
import { eq, desc, and } from 'drizzle-orm';
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
    const db = getSchemaDb(schema);

    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get('course_id');

    const enrollmentsData = await db.query.courseEnrollments.findMany({
      where: courseId ? eq(courseEnrollments.courseId, courseId) : undefined,
      with: {
        course: { columns: { id: true, name: true } },
        student: {
          columns: { id: true },
          with: { user: { columns: { firstName: true, lastName: true, email: true } } }
        }
      },
      orderBy: [desc(courseEnrollments.enrolledAt)]
    });

    const formatted = enrollmentsData.map(e => ({
      id: e.id,
      enrolled_at: e.enrolledAt,
      course_id: e.courseId,
      student_id: e.studentId,
      courses: { id: e.course?.id, name: e.course?.name },
      student: {
        id: e.student?.id,
        users: {
          first_name: e.student?.user?.firstName,
          last_name: e.student?.user?.lastName,
          email: e.student?.user?.email
        }
      }
    }));

    return NextResponse.json({ enrollments: formatted || [] });
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
    const db = getSchemaDb(schema);

    if (!student_id || !course_id) {
      return NextResponse.json({ error: 'student_id and course_id are required' }, { status: 400 });
    }

    const studentCheck = await db.query.students.findFirst({
      columns: { id: true },
      where: eq(students.id, student_id)
    });
    if (!studentCheck) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

    const courseCheck = await db.query.courses.findFirst({
      columns: { id: true, name: true },
      where: eq(courses.id, course_id)
    });
    if (!courseCheck) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

    try {
      const [data] = await db.insert(courseEnrollments)
        .values({ studentId: student_id, courseId: course_id })
        .returning();

      return NextResponse.json({ enrollment: data, message: `Student enrolled in ${courseCheck.name}` }, { status: 201 });
    } catch (insertError) {
      if (insertError.code === '23505') return NextResponse.json({ error: 'Student is already enrolled in this course' }, { status: 409 });
      throw insertError;
    }
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
    const db = getSchemaDb(schema);

    if (!student_id || !course_id) {
      return NextResponse.json({ error: 'student_id and course_id are required' }, { status: 400 });
    }

    await db.delete(courseEnrollments).where(
      and(
        eq(courseEnrollments.studentId, student_id),
        eq(courseEnrollments.courseId, course_id)
      )
    );

    return NextResponse.json({ message: 'Student unenrolled successfully' });
  } catch (err) {
    console.error('Enrollment DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(getHandler, ['admin']);
export const POST = withRole(postHandler, ['admin']);
export const DELETE = withRole(deleteHandler, ['admin']);
