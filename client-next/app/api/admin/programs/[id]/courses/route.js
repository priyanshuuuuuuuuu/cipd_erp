export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { withRole } from '@/lib/middleware';
import { addCoursesToProgram } from '@/lib/program-service';
import { errorResponse } from '@/lib/sql-ident';

// POST /api/admin/programs/:id/courses — add courses in the selected cohort.
async function postHandler(req, { params }) {
  try {
    const { courses } = await req.json();
    const result = await addCoursesToProgram(params.id, courses, req.cohortInfo);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return errorResponse(NextResponse, err, 'Add program courses error');
  }
}

export const POST = withRole(postHandler, ['admin']);
