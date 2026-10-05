export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { DEFAULT_SCHEMA } from '@/config';
import { getSchemaDb, getCohortConfig, getRequestSchema } from '@/lib/db';
import {
  students,
  users,
  courseEnrollments,
  courses,
  attendanceRecords,
  feedbackResponses,
  assignmentSubmissions,
  notifications,
} from '@/drizzle/schema';
import { eq, ne, inArray, desc } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';
import { hashPassword } from '@/lib/auth';

/** Resolve and validate schema from request. Returns null if invalid. */
async function resolveSchema(req) {
  const { searchParams } = new URL(req.url);
  const requested = searchParams.get('schema') || getRequestSchema() || DEFAULT_SCHEMA;
  const { schemas } = await getCohortConfig();
  return schemas.includes(requested) ? requested : null;
}

/** Same but reads schema from request body (for POST/PATCH/DELETE with JSON body) */
async function resolveSchemaFromBody(body) {
  const requested = body.schema || getRequestSchema() || DEFAULT_SCHEMA;
  const { schemas } = await getCohortConfig();
  return schemas.includes(requested) ? requested : null;
}

// ─── GET /api/admin/students?schema=july ─────────────────────────────────
async function getHandler(req) {
  try {
    const schema = await resolveSchema(req);
    if (!schema) return NextResponse.json({ error: 'Invalid schema' }, { status: 400 });
    const schemaDb = getSchemaDb(schema);

    const studentsData = await schemaDb
      .select({
        id: students.id,
        enrollment_no: students.enrollmentNo,
        program_name: students.programName,
        mac_address: students.macAddress,
        mac_verified: students.macVerified,
        created_at: students.createdAt,
        user_id: users.id,
        first_name: users.firstName,
        last_name: users.lastName,
        email: users.email,
        is_active: users.isActive,
        user_created_at: users.createdAt,
      })
      .from(students)
      .innerJoin(users, eq(students.id, users.id))
      .orderBy(desc(students.createdAt));

    const studentIds = studentsData.map(s => s.id);
    const enrollmentMap = {};

    if (studentIds.length > 0) {
      const enrollments = await schemaDb
        .select({
          student_id: courseEnrollments.studentId,
          course_id: courseEnrollments.courseId,
          enrolled_at: courseEnrollments.enrolledAt,
          course_name: courses.name,
          course_code: courses.code,
        })
        .from(courseEnrollments)
        .leftJoin(courses, eq(courseEnrollments.courseId, courses.id))
        .where(inArray(courseEnrollments.studentId, studentIds));

      enrollments.forEach(e => {
        if (!enrollmentMap[e.student_id]) enrollmentMap[e.student_id] = [];
        enrollmentMap[e.student_id].push({
          course_id: e.course_id,
          course_name: e.course_name || 'Unknown',
          course_code: e.course_code || '',
          enrolled_at: e.enrolled_at,
        });
      });
    }

    const result = studentsData.map(s => ({
      id: s.id,
      first_name: s.first_name || '',
      last_name: s.last_name || '',
      email: s.email || '',
      is_active: s.is_active ?? true,
      enrollment_no: s.enrollment_no || '',
      program_name: s.program_name || '',
      mac_address: s.mac_address || '',
      mac_verified: s.mac_verified ?? false,
      created_at: s.created_at,
      courses: enrollmentMap[s.id] || [],
    }));

    return NextResponse.json({ students: result, schema });
  } catch (err) {
    console.error('Students GET error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// ─── POST /api/admin/students — body: { ..., schema? } ───────────────────
async function postHandler(req) {
  try {
    const body = await req.json();
    const { first_name, last_name, email, enrollment_no, program_name } = body;
    const schema = await resolveSchemaFromBody(body);
    if (!schema) return NextResponse.json({ error: 'Invalid schema' }, { status: 400 });
    const schemaDb = getSchemaDb(schema);

    if (!first_name || !last_name || !email) {
      return NextResponse.json({ error: 'First name, last name, and email are required.' }, { status: 400 });
    }

    const [existingUser] = await schemaDb
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);
    if (existingUser) return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 409 });

    if (enrollment_no?.trim()) {
      const [existingEnroll] = await schemaDb
        .select({ id: students.id })
        .from(students)
        .where(eq(students.enrollmentNo, enrollment_no.trim()))
        .limit(1);
      if (existingEnroll) return NextResponse.json({ error: 'A student with this enrollment number already exists.' }, { status: 409 });
    }

    const password_hash = await hashPassword('12345678');

    const [newUser] = await schemaDb
      .insert(users)
      .values({
        firstName: first_name.trim(),
        lastName: last_name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash: password_hash,
        role: 'student',
        isActive: true,
      })
      .returning({ id: users.id });

    try {
      await schemaDb.insert(students).values({
        id: newUser.id,
        enrollmentNo: enrollment_no?.trim() || null,
        programName: program_name?.trim() || null,
      });
    } catch (stuErr) {
      await schemaDb.delete(users).where(eq(users.id, newUser.id));
      throw stuErr;
    }

    return NextResponse.json({ success: true, student: { id: newUser.id, first_name, last_name, email } }, { status: 201 });
  } catch (err) {
    console.error('Students POST error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH /api/admin/students — body: { ..., schema? } ──────────────────
async function patchHandler(req) {
  try {
    const body = await req.json();
    const { student_id, first_name, last_name, email, enrollment_no, program_name, mac_verified, is_active, mac_address } = body;
    const schema = await resolveSchemaFromBody(body);
    if (!schema) return NextResponse.json({ error: 'Invalid schema' }, { status: 400 });
    const schemaDb = getSchemaDb(schema);

    if (!student_id) return NextResponse.json({ error: 'student_id is required.' }, { status: 400 });

    if (mac_address !== undefined && mac_address !== '' && mac_address !== null) {
      if (!/^([A-Fa-f0-9]{2}:){5}[A-Fa-f0-9]{2}$/.test(mac_address)) {
        return NextResponse.json({ error: 'Invalid MAC address format. Use XX:XX:XX:XX:XX:XX' }, { status: 400 });
      }
    }

    if (email !== undefined) {
      const [conflict] = await schemaDb
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email.toLowerCase().trim()))
        .limit(1);
      if (conflict && conflict.id !== student_id) {
        return NextResponse.json({ error: 'This email is already used by another user.' }, { status: 409 });
      }
    }
    if (enrollment_no !== undefined && enrollment_no !== '') {
      const [conflict] = await schemaDb
        .select({ id: students.id })
        .from(students)
        .where(eq(students.enrollmentNo, enrollment_no.trim()))
        .limit(1);
      if (conflict && conflict.id !== student_id) {
        return NextResponse.json({ error: 'This enrollment number is already taken.' }, { status: 409 });
      }
    }

    const userUpdates = {};
    if (first_name !== undefined) userUpdates.firstName = first_name.trim();
    if (last_name !== undefined) userUpdates.lastName = last_name.trim();
    if (email !== undefined) userUpdates.email = email.toLowerCase().trim();
    if (is_active !== undefined) userUpdates.isActive = Boolean(is_active);

    if (Object.keys(userUpdates).length > 0) {
      await schemaDb.update(users).set(userUpdates).where(eq(users.id, student_id));
    }

    const stuUpdates = {};
    if (enrollment_no !== undefined) stuUpdates.enrollmentNo = enrollment_no.trim() || null;
    if (program_name !== undefined) stuUpdates.programName = program_name.trim() || null;
    if (mac_verified !== undefined) stuUpdates.macVerified = Boolean(mac_verified);
    if (mac_address !== undefined) {
      if (mac_address === '' || mac_address === null) {
        // Clearing a MAC — also clear verification
        stuUpdates.macAddress = null;
        stuUpdates.macVerified = false;
      } else {
        // Admin is setting a MAC directly — trust it immediately, no approval needed
        stuUpdates.macAddress = mac_address.toUpperCase();
        stuUpdates.macVerified = true;
      }
    }

    if (Object.keys(stuUpdates).length > 0) {
      await schemaDb.update(students).set(stuUpdates).where(eq(students.id, student_id));
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Students PATCH error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE /api/admin/students — body: { student_id, schema? } ──────────
// Manually deletes all child records first because the public schema does not
// have ON DELETE CASCADE on all FKs (unlike the july schema).
async function deleteHandler(req) {
  try {
    const body = await req.json();
    const { student_id, student_ids } = body;
    const ids = student_ids || (student_id ? [student_id] : []);
    const schema = await resolveSchemaFromBody(body);
    if (!schema) return NextResponse.json({ error: 'Invalid schema' }, { status: 400 });
    const schemaDb = getSchemaDb(schema);

    if (ids.length === 0) return NextResponse.json({ error: 'student_id or student_ids is required.' }, { status: 400 });

    // 1. Delete attendance_records (references students.id)
    await schemaDb.delete(attendanceRecords).where(inArray(attendanceRecords.studentId, ids));

    // 2. Delete feedback_responses (references students.id)
    await schemaDb.delete(feedbackResponses).where(inArray(feedbackResponses.studentId, ids));

    // 3. Delete assignment_submissions (references students.id)
    await schemaDb.delete(assignmentSubmissions).where(inArray(assignmentSubmissions.studentId, ids));

    // 4. Delete course_enrollments (references students.id)
    await schemaDb.delete(courseEnrollments).where(inArray(courseEnrollments.studentId, ids));

    // 5. Delete notifications (references users.id as recipient)
    await schemaDb.delete(notifications).where(inArray(notifications.recipientId, ids));

    // 6. Delete the students row (references users.id)
    await schemaDb.delete(students).where(inArray(students.id, ids));

    // 7. Finally delete the users row
    await schemaDb.delete(users).where(inArray(users.id, ids));

    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (err) {
    console.error('Students DELETE error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(getHandler, ['admin']);
export const POST = withRole(postHandler, ['admin']);
export const PATCH = withRole(patchHandler, ['admin']);
export const DELETE = withRole(deleteHandler, ['admin']);

