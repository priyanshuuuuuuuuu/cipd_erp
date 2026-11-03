export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { withRole } from '@/lib/middleware';
import { updateCohort } from '@/lib/cohorts';
import { errorResponse } from '@/lib/sql-ident';

// PATCH /api/admin/cohorts/[id]
// Body: any of { label, program, starts_on, ends_on, status: 'running'|'archived', is_default }.
// schema_name is immutable. Archiving completes all active memberships. There is deliberately no HTTP delete:
// use scripts/cohort-delete.mjs (it takes a backup first).
async function patchHandler(req, { params }) {
  try {
    const cohort = await updateCohort(params.id, await req.json());
    return NextResponse.json({ success: true, cohort });
  } catch (err) {
    return errorResponse(NextResponse, err, 'Update cohort error');
  }
}

export const PATCH = withRole(patchHandler, ['admin'], { allowArchivedWrites: true });
