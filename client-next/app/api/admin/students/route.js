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
  notificationStream,
  leaveRequests,
  attendancePingLogs,
  studentAttendanceMarks,
  studentCourseAttendance,
} from '@/drizzle/schema';
import crypto from 'node:crypto';
import { eq, ne, inArray, desc } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';
import { hashPassword } from '@/lib/auth';
import { findExistingStudentAcrossCohorts, invalidateMembershipCache } from '@/lib/cohorts';

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

    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check if user already exists in this target cohort
    const [existingInTarget] = await schemaDb
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);
    if (existingInTarget) {
      return NextResponse.json({ error: 'A user with this email already exists in this cohort.' }, { status: 409 });
    }

    // 2. Check if student already exists in ANY other cohort schema (reuse account & copy all profile/MAC data)
    const existingAcrossCohorts = await findExistingStudentAcrossCohorts(normalizedEmail, schema);

    const targetEnrollmentNo = enrollment_no?.trim() || existingAcrossCohorts?.enrollment_no || null;
    if (targetEnrollmentNo) {
      const [existingEnroll] = await schemaDb
        .select({ id: students.id })
        .from(students)
        .where(eq(students.enrollmentNo, targetEnrollmentNo))
        .limit(1);
      if (existingEnroll) {
        return NextResponse.json({ error: 'A student with this enrollment number already exists.' }, { status: 409 });
      }
    }

    let studentId;
    let reused = false;

    // Everything below is one transaction: either the whole student exists or nothing does.
    await schemaDb.transaction(async (tx) => {
      if (existingAcrossCohorts) {
        // Re-use existing account: keep id, password_hash, role, preferences
        studentId = existingAcrossCohorts.id;
        reused = true;

        await tx.insert(users).values({
          id: existingAcrossCohorts.id,
          firstName: first_name.trim() || existingAcrossCohorts.first_name || '',
          lastName: last_name.trim() || existingAcrossCohorts.last_name || '',
          email: normalizedEmail,
          passwordHash: existingAcrossCohorts.password_hash,
          role: 'student',
          isActive: true,
          preferences: existingAcrossCohorts.preferences ?? null,
        });

        // Copy profile/MAC data from the previous cohort
        await tx.insert(students).values({
          id: existingAcrossCohorts.id,
          enrollmentNo: targetEnrollmentNo,
          programName: program_name?.trim() || existingAcrossCohorts.program_name || null,
          deviceHash: existingAcrossCohorts.device_hash || null,
          macAddress: existingAcrossCohorts.mac_address || null,
          macVerified: existingAcrossCohorts.mac_verified ?? false,
          photoUrl: existingAcrossCohorts.photo_url || null,
        });
      } else {
        // Brand-new student: random unusable password; the student sets one via "Forgot password".
        const password_hash = await hashPassword(crypto.randomBytes(24).toString('base64url'));
        const [newUser] = await tx
          .insert(users)
          .values({
            firstName: first_name.trim(),
            lastName: last_name.trim(),
            email: normalizedEmail,
            passwordHash: password_hash,
            role: 'student',
            isActive: true,
          })
          .returning({ id: users.id });
        studentId = newUser.id;

        await tx.insert(students).values({
          id: studentId,
          enrollmentNo: targetEnrollmentNo,
          programName: program_name?.trim() || null,
        });
      }

      // Auto-enroll the student in all existing courses of this cohort
      const allCourses = await tx.select({ id: courses.id }).from(courses);
      if (allCourses.length > 0) {
        await tx.insert(courseEnrollments).values(
          allCourses.map(c => ({ studentId, courseId: c.id }))
        ).onConflictDoNothing();
      }
    });
    invalidateMembershipCache();

    return NextResponse.json({
      success: true,
      reused,
      student: {
        id: studentId,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: normalizedEmail,
        enrollment_no: targetEnrollmentNo,
        mac_address: existingAcrossCohorts?.mac_address || null,
        mac_verified: existingAcrossCohorts?.mac_verified ?? false,
      }
    }, { status: 201 });
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

    await schemaDb.transaction(async (tx) => {
      if (Object.keys(userUpdates).length > 0) {
        await tx.update(users).set(userUpdates).where(eq(users.id, student_id));
      }
      if (Object.keys(stuUpdates).length > 0) {
        await tx.update(students).set(stuUpdates).where(eq(students.id, student_id));
      }
    });
    invalidateMembershipCache();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Students PATCH error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE /api/admin/students — body: { student_id, schema? } ──────────
// Deletes all child records explicitly, inside one transaction. Only the `public`
// schema has ON DELETE CASCADE on all FKs; `july` and `junedecember2026` mostly use
// NO ACTION and lack 14 FKs, so we cannot rely on the database to cascade.
async function deleteHandler(req) {
  try {
    const body = await req.json();
    const { student_id, student_ids } = body;
    const ids = student_ids || (student_id ? [student_id] : []);
    const schema = await resolveSchemaFromBody(body);
    if (!schema) return NextResponse.json({ error: 'Invalid schema' }, { status: 400 });
    const schemaDb = getSchemaDb(schema);

    if (ids.length === 0) return NextResponse.json({ error: 'student_id or student_ids is required.' }, { status: 400 });

    await schemaDb.transaction(async (tx) => {
      await tx.delete(attendanceRecords).where(inArray(attendanceRecords.studentId, ids));
      await tx.delete(feedbackResponses).where(inArray(feedbackResponses.studentId, ids));
      await tx.delete(assignmentSubmissions).where(inArray(assignmentSubmissions.studentId, ids));
      await tx.delete(courseEnrollments).where(inArray(courseEnrollments.studentId, ids));
      await tx.delete(leaveRequests).where(inArray(leaveRequests.studentId, ids));
      await tx.delete(attendancePingLogs).where(inArray(attendancePingLogs.studentId, ids));
      await tx.delete(studentAttendanceMarks).where(inArray(studentAttendanceMarks.studentId, ids));
      await tx.delete(studentCourseAttendance).where(inArray(studentCourseAttendance.studentId, ids));
      await tx.delete(notifications).where(inArray(notifications.recipientId, ids));
      await tx.delete(notificationStream).where(inArray(notificationStream.recipientId, ids));
      await tx.delete(students).where(inArray(students.id, ids));
      await tx.delete(users).where(inArray(users.id, ids));
    });
    invalidateMembershipCache();

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

