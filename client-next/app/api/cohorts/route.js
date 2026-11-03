export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { getCohortConfig } from '@/lib/db';
import { getAccountContext } from '@/lib/accounts';

// GET /api/cohorts
// Cohorts the signed-in user may switch between. Admins: every running/archived cohort.
// Faculty and students: only cohorts they have a membership in.
async function handler(req) {
  try {
    const { cohorts, active } = await getCohortConfig();
    let allowed = cohorts;
    if (req.user.role !== 'admin') {
      const ctx = await getAccountContext(req.user.accountId);
      const mine = new Set((ctx?.memberships || []).map((m) => m.cohort_id));
      allowed = cohorts.filter((c) => mine.has(c.id));
    }
    return NextResponse.json({
      cohorts: allowed.map((c) => ({
        id: c.id, schema: c.schema, label: c.label, program: c.program,
        starts_on: c.starts_on, ends_on: c.ends_on, status: c.status,
        is_default: c.schema === active,
        is_active: c.schema === active, // legacy name
      })),
      active,
      default: active,
      current: req.cohort,
    });
  } catch (err) {
    console.error('Cohorts list error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
