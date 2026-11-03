export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { generateAndSendDailyDigests } from '@/lib/daily-digest';
import { forEachRunningCohort, sumField } from '@/lib/cohort-jobs';
import { errorResponse } from '@/lib/sql-ident';

/**
 * Validates request authorization:
 * - Checks x-cron-secret header
 * - Or Authorization: Bearer <CRON_SECRET>
 * - In development mode, allows execution if neither header is set.
 */
function isAuthorized(req) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // If no secret configured, allow only in dev mode
    return process.env.NODE_ENV === 'development';
  }

  const headerSecret = req.headers.get('x-cron-secret');
  if (headerSecret && headerSecret === cronSecret) return true;

  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader === `Bearer ${cronSecret}`) return true;

  // Allow dev testing without secret
  if (process.env.NODE_ENV === 'development') return true;

  return false;
}

/**
 * Shared handler for daily student digest dispatch.
 */
async function handleDigest(req) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    let body = {};
    if (req.method === 'POST') {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    const targetDate = searchParams.get('date') || body.date || undefined;
    // Optional ?schema= narrows the run to one cohort; it is validated against the running cohorts.
    const only = searchParams.get('schema') || body.schema || undefined;
    const dryRun = searchParams.get('dry_run') === 'true' || body.dryRun === true;
    const testEmail = searchParams.get('test_email') || body.testEmail || undefined;
    const studentId = searchParams.get('student_id') || body.studentId || undefined;

    const cohorts = await forEachRunningCohort(
      (schema) => generateAndSendDailyDigests({ targetDate, schema, dryRun, testEmail, studentId }),
      { only }
    );

    // Top-level fields are sums over cohorts (the digest worker prints them); per-cohort detail is under `cohorts`.
    const first = Object.values(cohorts).find((r) => r && !r.error) || {};
    const errors = Object.entries(cohorts).flatMap(([schema, r]) =>
      r?.error ? [{ schema, error: r.error }] : (r?.errors || []).map((e) => ({ schema, ...e })));
    return NextResponse.json({
      success: Object.values(cohorts).every((r) => !r?.error),
      date: first.date,
      formattedDate: first.formattedDate,
      totalSessions: sumField(cohorts, 'totalSessions'),
      totalStudents: sumField(cohorts, 'totalStudents'),
      sentCount: sumField(cohorts, 'sentCount'),
      failedCount: sumField(cohorts, 'failedCount') + Object.values(cohorts).filter((r) => r?.error).length,
      errors: errors.length ? errors : undefined,
      cohorts,
    });
  } catch (err) {
    return errorResponse(NextResponse, err, 'Daily student digest error');
  }
}

export async function GET(req) {
  return handleDigest(req);
}

export async function POST(req) {
  return handleDigest(req);
}
