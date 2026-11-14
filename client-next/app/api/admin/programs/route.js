export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { withAuth, withRole } from '@/lib/middleware';
import { listPrograms, listProgramCatalog, createProgramWithCourses } from '@/lib/program-service';
import { errorResponse } from '@/lib/sql-ident';

// GET: basic global list for dropdowns, or the selected cohort's nested catalog.
async function getHandler(req) {
  try {
    const includeCourses = new URL(req.url).searchParams.get('include_courses') === '1';
    if (includeCourses) {
      if (req.user.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const catalog = await listProgramCatalog(req.cohortInfo);
      return NextResponse.json({
        programs: catalog.programs,
        unassigned_courses: catalog.unassignedCourses,
        cohort: req.cohortInfo,
      });
    }
    return NextResponse.json({ programs: await listPrograms() });
  } catch (err) {
    return errorResponse(NextResponse, err, 'Programs GET error');
  }
}

async function postHandler(req) {
  try {
    const body = await req.json();
    const program = await createProgramWithCourses(body, req.cohortInfo);
    return NextResponse.json({ program }, { status: 201 });
  } catch (err) {
    return errorResponse(NextResponse, err, 'Programs POST error');
  }
}

export const GET = withAuth(getHandler);
// Program creation also creates cohort-local courses; the service rejects archived cohorts.
export const POST = withRole(postHandler, ['admin'], { allowArchivedWrites: true });
