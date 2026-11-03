// npm run migrate [-- --dry-run] [--cohort <schema>] [--mark-applied <version> --cohort <schema>] [--url <DATABASE_URL>]
//
// Applies migrations/core/*.sql once, then migrations/cohort/*.sql to every cohort in core.cohorts.
// A failure in one cohort is logged, the others continue, and the exit code is non-zero.
import postgres from 'postgres';
import dotenv from 'dotenv';
import { pathToFileURL } from 'node:url';
import {
  acquireLock, applyCoreMigrations, applyCohortMigrations, listMigratableCohorts, markApplied, assertSchemaName,
} from '../lib/migrator.mjs';

dotenv.config({ path: '.env', quiet: true });
dotenv.config({ path: '.env.local', override: false, quiet: true });

export async function main(argv = process.argv.slice(2)) {
  const flag = (n) => argv.includes(`--${n}`);
  const opt = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };

  const url = opt('url') || process.env.DATABASE_URL;
  if (!url) { console.error('DATABASE_URL (or --url) is required'); return 2; }
  try { const u = new URL(url); console.log(`target: ${u.hostname}:${u.port || 5432}${u.pathname}${argv.includes('--dry-run') ? ' (dry run)' : ''}`); } catch { /* not a URL */ }
  const dryRun = flag('dry-run');
  const onlyCohort = opt('cohort');
  const mark = opt('mark-applied');
  if (onlyCohort) assertSchemaName(onlyCohort);

  const sql = postgres(url, {
    max: 3, prepare: false, onnotice: (n) => console.log(`  NOTICE: ${n.message}`),
  });
  let failed = false;
  let release = async () => {};
  try {
    release = await acquireLock(sql);

    if (mark) {
      if (!onlyCohort) { console.error('--mark-applied requires --cohort <schema>'); return 2; }
      await markApplied(sql, onlyCohort, mark);
      console.log(`marked ${onlyCohort} migration ${mark} as applied (not executed)`);
      return 0;
    }

    if (!onlyCohort) await applyCoreMigrations(sql, { dryRun });

    const [{ has_core }] = await sql`SELECT to_regclass('core.cohorts') IS NOT NULL AS has_core`;
    if (!has_core) { console.log('core.cohorts does not exist yet (dry run before first apply): skipping cohorts'); return 0; }

    for (const c of await listMigratableCohorts(sql)) {
      if (onlyCohort && c.schema_name !== onlyCohort) continue;
      try {
        const ran = await applyCohortMigrations(sql, c.schema_name, c.id, { dryRun });
        if (!ran.length) console.log(`${c.schema_name}: up to date`);
      } catch (err) {
        failed = true;
        console.error(`FAILED ${c.schema_name}: ${err.message}`);
      }
    }
    return failed ? 1 : 0;
  } finally {
    await release().catch(() => {});
    await sql.end({ timeout: 5 });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => process.exit(code), (err) => { console.error(err); process.exit(1); });
}
