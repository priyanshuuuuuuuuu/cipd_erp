export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { withRole } from '@/lib/middleware';
import { createCohort, setActiveCohort, listCohortsForAdmin } from '@/lib/cohorts';
import { errorResponse } from '@/lib/sql-ident';

// All handlers here are account/registry level, not cohort data, so they work while an archived cohort is selected.
const OPTS = { allowArchivedWrites: true };

// GET /api/admin/cohorts — every cohort (including provisioning/failed) with member counts.
// `schemas`, `labels` and `active` are kept for older callers.
async function getHandler() {
  try {
    const cohorts = await listCohortsForAdmin();
    const usable = cohorts.filter((c) => c.status === 'running' || c.status === 'archived');
    const labels = Object.fromEntries(usable.map((c) => [c.schema, c.label]));
    const active = cohorts.find((c) => c.is_default)?.schema ?? null;
    return NextResponse.json({ cohorts, schemas: usable.map((c) => c.schema), labels, active });
  } catch (err) {
    return errorResponse(NextResponse, err, 'Cohorts list error');
  }
}

// POST /api/admin/cohorts
// Body: { schema_name, label, program?, starts_on?, ends_on?, reference_from_cohort_id?,
//         students?: [{ name, email, enrollment_no?, program_id? }], copy_active_students_from_cohort_id?, make_default? }
async function postHandler(req) {
  try {
    const b = await req.json();
    const result = await createCohort({
      schemaName: b.schema_name ?? b.schemaName,
      label: b.label,
      program: b.program,
      startsOn: b.starts_on,
      endsOn: b.ends_on,
      referenceCohortId: b.reference_from_cohort_id ?? null,
      students: b.students,
      copyActiveStudentsFromCohortId: b.copy_active_students_from_cohort_id ?? null,
      makeDefault: !!(b.make_default ?? b.makeActive),
      createdBy: req.user.accountId,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return errorResponse(NextResponse, err, 'Create cohort error');
  }
}

// PATCH /api/admin/cohorts — legacy: { schemaName } makes that cohort the default. Prefer PATCH /api/admin/cohorts/[id].
async function patchHandler(req) {
  try {
    const { schemaName } = await req.json();
    await setActiveCohort(schemaName);
    return NextResponse.json({ success: true, active: schemaName });
  } catch (err) {
    return errorResponse(NextResponse, err, 'Activate cohort error');
  }
}

export const GET = withRole(getHandler, ['admin'], OPTS);
export const POST = withRole(postHandler, ['admin'], OPTS);
export const PATCH = withRole(patchHandler, ['admin'], OPTS);
