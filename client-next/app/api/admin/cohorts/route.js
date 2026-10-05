export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { withRole } from '@/lib/middleware';
import { getCohortConfig } from '@/lib/db';
import { createCohort, setActiveCohort } from '@/lib/cohorts';

// GET /api/admin/cohorts
// Returns the registered cohorts ({ schemas, labels, active }) from public.cohorts.
async function getHandler() {
  try {
    const config = await getCohortConfig();
    return NextResponse.json(config);
  } catch (err) {
    console.error('Cohorts config error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/cohorts
// Body: { schemaName, label, students: [{ name, email, enrollment_no?, program_name? }], makeActive }
// Creates a fresh cohort schema (structure + reference data cloned from the active cohort).
async function postHandler(req) {
  try {
    const body = await req.json();
    const result = await createCohort({
      schemaName: body.schemaName,
      label: body.label,
      students: body.students,
      makeActive: !!body.makeActive,
      sourceSchema: body.sourceSchema,
      createdBy: req.user.id,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('Create cohort error:', err);
    return NextResponse.json({ error: 'Failed to create cohort: ' + err.message }, { status: 500 });
  }
}

// PATCH /api/admin/cohorts
// Body: { schemaName } — marks that cohort as the active one.
async function patchHandler(req) {
  try {
    const { schemaName } = await req.json();
    await setActiveCohort(schemaName);
    return NextResponse.json({ success: true, active: schemaName });
  } catch (err) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('Activate cohort error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(getHandler, ['admin']);
export const POST = withRole(postHandler, ['admin']);
export const PATCH = withRole(patchHandler, ['admin']);
