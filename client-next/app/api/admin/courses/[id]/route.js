export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { withRole } from '@/lib/middleware';
import { updateCourse } from '@/lib/program-service';
import { errorResponse } from '@/lib/sql-ident';

// PATCH /api/admin/courses/:id — edit a course in the selected cohort. Body: { name, code, description? }
async function patchHandler(req, { params }) {
  try {
    const body = await req.json();
    const course = await updateCourse(params.id, body, req.cohortInfo);
    return NextResponse.json({ course });
  } catch (err) {
    return errorResponse(NextResponse, err, 'Course update error');
  }
}

export const PATCH = withRole(patchHandler, ['admin']);
