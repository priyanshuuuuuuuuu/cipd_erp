export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { withAuth, withRole } from '@/lib/middleware';
import { listPrograms, createProgram } from '@/lib/student-service';
import { errorResponse } from '@/lib/sql-ident';

// GET: programs for the dropdown (any signed-in user). POST: admins add a program.
async function getHandler() {
  try {
    return NextResponse.json({ programs: await listPrograms() });
  } catch (err) {
    return errorResponse(NextResponse, err, 'Programs GET error');
  }
}

async function postHandler(req) {
  try {
    const { name } = await req.json();
    return NextResponse.json({ program: await createProgram(name) }, { status: 201 });
  } catch (err) {
    return errorResponse(NextResponse, err, 'Programs POST error');
  }
}

export const GET = withAuth(getHandler);
// Programs are global, not cohort data: allowed even while an archived cohort is selected.
export const POST = withRole(postHandler, ['admin'], { allowArchivedWrites: true });
