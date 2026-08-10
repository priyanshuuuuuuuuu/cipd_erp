export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { withRole } from '@/lib/middleware';
import { getCohortConfig } from '@/lib/supabase';

// GET /api/admin/cohorts
// Returns the list of available cohort schemas and their display labels.
// Driven by COHORT_SCHEMAS + COHORT_LABELS env vars.
async function handler() {
  try {
    const config = getCohortConfig();
    return NextResponse.json(config);
  } catch (err) {
    console.error('Cohorts config error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(handler, ['admin']);
