export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { getCohortConfig } from '@/lib/db';
import { getUserCohorts } from '@/lib/cohorts';

// GET /api/cohorts
// Cohorts the signed-in user may switch between. Admin/faculty: all cohorts.
// Students: only cohorts they belong to.
async function handler(req) {
  try {
    const { schemas, labels, active } = await getCohortConfig();
    let allowed = schemas;
    if (req.user.role === 'student') {
      const mine = await getUserCohorts(req.user.id);
      allowed = schemas.filter(s => mine.includes(s));
    }
    return NextResponse.json({
      cohorts: allowed.map(s => ({ schema: s, label: labels[s] || s, is_active: s === active })),
      active,
      current: req.cohort,
    });
  } catch (err) {
    console.error('Cohorts list error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
