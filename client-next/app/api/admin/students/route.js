export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { withRole } from '@/lib/middleware';
import { createStudent, updateStudent, withdrawStudent, listCohortStudents } from '@/lib/student-service';
import { errorResponse, HttpError } from '@/lib/sql-ident';

// Cohort comes ONLY from the middleware (x-cohort), never from a query/body `schema`.
// Exception: POST takes an explicit, required `cohort_id` (validated against core.cohorts by the service).

// ─── GET /api/admin/students ─────────────────────────────────────────────
async function getHandler(req) {
  try {
    const students = await listCohortStudents(req.cohortInfo);
    return NextResponse.json({ students, schema: req.cohort, cohort_id: req.cohortInfo.id });
  } catch (err) {
    return errorResponse(NextResponse, err, 'Students GET error');
  }
}

// ─── POST /api/admin/students — body: { cohort_id, first_name, last_name, email, enrollment_no?, program_id? } ───
async function postHandler(req) {
  try {
    const b = await req.json();
    if (b.cohort_id === undefined || b.cohort_id === null || b.cohort_id === '') {
      throw new HttpError(400, 'cohort_id is required.');
    }
    if (!b.first_name || !b.last_name || !b.email) {
      throw new HttpError(400, 'First name, last name, and email are required.');
    }
    const { student, created, reused } = await createStudent({
      cohortId: Number(b.cohort_id),
      firstName: b.first_name,
      lastName: b.last_name,
      email: b.email,
      enrollmentNo: b.enrollment_no,
      programId: b.program_id ?? null,
    });
    return NextResponse.json({ success: true, created, reused, student }, { status: 201 });
  } catch (err) {
    return errorResponse(NextResponse, err, 'Students POST error');
  }
}

// ─── PATCH /api/admin/students — body: { student_id, ... } (kept for the existing UI; prefer PATCH /[id]) ───
async function patchHandler(req) {
  try {
    const body = await req.json();
    const { student_id, program_name, ...patch } = body;
    if (!student_id) throw new HttpError(400, 'student_id is required.');
    if (program_name !== undefined && patch.program_id === undefined) {
      throw new HttpError(400, 'Choose a program from the list (program_id).');
    }
    await updateStudent(student_id, req.cohortInfo, patch);
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(NextResponse, err, 'Students PATCH error');
  }
}

// ─── DELETE /api/admin/students — body: { student_id | student_ids } ─────
// Bulk "remove from cohort": WITHDRAWS (membership withdrawn, login for this cohort off). Nothing is deleted.
// Permanent deletion is DELETE /api/admin/students/[id] with { confirm: <email> }.
async function deleteHandler(req) {
  try {
    const { student_id, student_ids } = await req.json();
    const ids = student_ids || (student_id ? [student_id] : []);
    if (!ids.length) throw new HttpError(400, 'student_id or student_ids is required.');
    let withdrawn = 0;
    const failed = [];
    for (const id of ids) {
      try { await withdrawStudent(id, req.cohortInfo.id); withdrawn++; } catch (e) { failed.push({ id, error: e.message }); }
    }
    return NextResponse.json({ success: true, withdrawn, failed });
  } catch (err) {
    return errorResponse(NextResponse, err, 'Students DELETE error');
  }
}

export const GET = withRole(getHandler, ['admin']);
// POST targets the cohort named in the body, so it must not be blocked just because the admin is browsing an archived one.
export const POST = withRole(postHandler, ['admin'], { allowArchivedWrites: true });
export const PATCH = withRole(patchHandler, ['admin']);
export const DELETE = withRole(deleteHandler, ['admin']);
