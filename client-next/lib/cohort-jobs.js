import { runWithSchema, getRunningSchemas } from '@/lib/db';
import { HttpError } from '@/lib/sql-ident';

/**
 * Run a background job once for every RUNNING cohort (archived cohorts are never touched by jobs).
 * Each run executes inside runWithSchema(), so the shared `db` export targets that cohort. A failure in one
 * cohort is caught and reported; the others still run.
 *
 * @param {(schema: string) => Promise<any>} fn
 * @param {{ only?: string }} [options] restrict to one cohort (must be running)
 * @returns {Promise<Record<string, any | { error: string }>>} results keyed by cohort schema
 */
export async function forEachRunningCohort(fn, { only } = {}) {
  const running = await getRunningSchemas();
  let targets = running;
  if (only) {
    if (!running.includes(only)) throw new HttpError(400, `"${only}" is not a running cohort.`);
    targets = [only];
  }
  const out = {};
  for (const schema of targets) {
    try {
      out[schema] = await runWithSchema(schema, () => fn(schema));
    } catch (err) {
      console.error(`[cohort-jobs] ${schema} failed:`, err);
      out[schema] = { error: err.message || String(err) };
    }
  }
  return out;
}

/** Sum a numeric field over the successful per-cohort results. */
export function sumField(results, field) {
  return Object.values(results).reduce((n, r) => n + (Number(r?.[field]) || 0), 0);
}

/**
 * Adapter for existing cron handlers that return a NextResponse: runs `handler(req)` for each running cohort and
 * parses its JSON body. A non-2xx response counts as that cohort's error.
 */
export function cronHandlerRunner(handler, req) {
  return async () => {
    const res = await handler(req);
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
    return body;
  };
}
