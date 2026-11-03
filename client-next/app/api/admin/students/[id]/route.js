export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { withRole } from '@/lib/middleware';
import { updateStudent, purgeStudentFromCohort } from '@/lib/student-service';
import { errorResponse, HttpError } from '@/lib/sql-ident';

// PATCH /api/admin/students/[id]  (id = the student's id in the selected cohort)
// body: { first_name?, last_name?, email?, enrollment_no?, program_id?, mac_address?, mac_verified?, is_active? }
async function patchHandler(req, { params }) {
  try {
    await updateStudent(params.id, req.cohortInfo, await req.json());
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(NextResponse, err, 'Student PATCH error');
  }
}

// DELETE /api/admin/students/[id]  body: { confirm: <the student's email> }
// Permanently deletes the student's data in this (running) cohort.
async function deleteHandler(req, { params }) {
  try {
    const body = await req.json().catch(() => ({}));
    if (!body.confirm) throw new HttpError(400, 'Type the student email to confirm permanent deletion.');
    const result = await purgeStudentFromCohort(params.id, req.cohortInfo.id, { confirm: body.confirm });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return errorResponse(NextResponse, err, 'Student DELETE error');
  }
}

export const PATCH = withRole(patchHandler, ['admin']);
export const DELETE = withRole(deleteHandler, ['admin']);
