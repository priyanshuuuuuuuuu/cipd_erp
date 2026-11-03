export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { withRole } from '@/lib/middleware';
import { transferStudent } from '@/lib/student-service';
import { errorResponse, HttpError } from '@/lib/sql-ident';

// POST /api/admin/students/[id]/transfer   body: { to_cohort_id, program_id? }
// Moves the student from the selected cohort to another RUNNING cohort. History stays in the source cohort.
// The source cohort may be archived (the service performs the one allowed write there), so the HTTP guard is relaxed.
async function handler(req, { params }) {
  try {
    const { to_cohort_id, program_id } = await req.json();
    if (!to_cohort_id) throw new HttpError(400, 'to_cohort_id is required.');
    const result = await transferStudent(params.id, req.cohortInfo.id, Number(to_cohort_id), { programId: program_id });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return errorResponse(NextResponse, err, 'Student transfer error');
  }
}

export const POST = withRole(handler, ['admin'], { allowArchivedWrites: true });
