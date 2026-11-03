export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { withRole } from '@/lib/middleware';
import { retryCohort } from '@/lib/cohorts';
import { errorResponse } from '@/lib/sql-ident';

// POST /api/admin/cohorts/[id]/retry — re-run provisioning for a cohort whose status is 'failed'.
async function postHandler(req, { params }) {
  try {
    return NextResponse.json(await retryCohort(params.id));
  } catch (err) {
    return errorResponse(NextResponse, err, 'Retry cohort error');
  }
}

export const POST = withRole(postHandler, ['admin'], { allowArchivedWrites: true });
