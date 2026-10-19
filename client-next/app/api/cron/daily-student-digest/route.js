export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { generateAndSendDailyDigests } from '@/lib/daily-digest';
import { getActiveSchema } from '@/lib/db';

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
    const schema = searchParams.get('schema') || body.schema || (await getActiveSchema());
    const dryRun = searchParams.get('dry_run') === 'true' || body.dryRun === true;
    const testEmail = searchParams.get('test_email') || body.testEmail || undefined;
    const studentId = searchParams.get('student_id') || body.studentId || undefined;

    const result = await generateAndSendDailyDigests({
      targetDate,
      schema,
      dryRun,
      testEmail,
      studentId,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('Daily student digest error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(req) {
  return handleDigest(req);
}

export async function POST(req) {
  return handleDigest(req);
}
