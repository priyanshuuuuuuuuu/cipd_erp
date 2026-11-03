// node scripts/cohort-delete.mjs --cohort <schema> --confirm <schema> [--url <DATABASE_URL>] [--backup-dir <dir>]
//
// The ONLY way to hard-delete a cohort (there is no HTTP endpoint). Refuses legacy, default and running cohorts.
//  1. pg_dump -Fc of the cohort schema into BACKUP_DIR (verified non-empty) - nothing is dropped if this fails
//  2. status -> 'deleting'
//  3. ONE transaction: DROP SCHEMA ... CASCADE, delete its memberships, delete student accounts left with no
//     memberships (and no aliases), delete its migration ledger rows and its core.cohorts row
// Needs pg_dump on the PATH (or set PG_DUMP to its full path).
import postgres from 'postgres';
import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

dotenv.config({ path: '.env', quiet: true });
dotenv.config({ path: '.env.local', override: false, quiet: true });

const qid = (s) => '"' + String(s).replace(/"/g, '""') + '"';

function pgDump(url, schema, file) {
  return new Promise((resolve, reject) => {
    const bin = process.env.PG_DUMP || 'pg_dump';
    const p = spawn(bin, [url, '-Fc', '-n', schema, '--no-owner', '--no-privileges', '-f', file], { stdio: ['ignore', 'inherit', 'inherit'] });
    p.on('error', (e) => reject(new Error(`could not run ${bin}: ${e.message}`)));
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`pg_dump exited with ${code}`))));
  });
}

export async function main(argv = process.argv.slice(2)) {
  const opt = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  const schema = opt('cohort');
  const confirm = opt('confirm');
  const url = opt('url') || process.env.DATABASE_URL;
  const backupDir = path.resolve(opt('backup-dir') || process.env.BACKUP_DIR || './backups');

  if (!schema || !/^[a-z][a-z0-9_]{2,40}$/.test(schema)) { console.error('--cohort <schema> is required'); return 2; }
  if (confirm !== schema) { console.error(`Refusing: pass --confirm ${schema} to acknowledge that this deletes the cohort.`); return 2; }
  if (!url) { console.error('DATABASE_URL (or --url) is required'); return 2; }
  try { const u = new URL(url); console.log(`target: ${u.hostname}:${u.port || 5432}${u.pathname}`); } catch { /* ignore */ }

  const sql = postgres(url, { max: 2, prepare: false, onnotice: () => {} });
  try {
    const [c] = await sql`SELECT id, schema_name, status, is_default, is_legacy FROM core.cohorts WHERE schema_name = ${schema}`;
    if (!c) { console.error(`No such cohort: ${schema}`); return 1; }
    if (c.is_legacy) { console.error('Refusing: this is a legacy cohort (public/july). Legacy data is preserved.'); return 1; }
    if (c.is_default) { console.error('Refusing: this is the default cohort.'); return 1; }
    if (c.status === 'running' || c.status === 'provisioning') { console.error(`Refusing: cohort is ${c.status}. Archive it first (Admin > Cohorts).`); return 1; }

    await fs.mkdir(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(backupDir, `${schema}_${stamp}.dump`);
    console.log(`backing up to ${file} ...`);
    await pgDump(url, schema, file);
    const { size } = await fs.stat(file);
    if (!size) throw new Error('backup file is empty; nothing was deleted');
    console.log(`backup ok (${size} bytes)`);

    await sql`UPDATE core.cohorts SET status = 'deleting', updated_at = now() WHERE id = ${c.id}`;
    try {
    await sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(hashtext('cipd_migrations'))`;
      await tx.unsafe(`DROP SCHEMA ${qid(schema)} CASCADE`);
      await tx`DELETE FROM core.cohort_memberships WHERE cohort_id = ${c.id}`;
      // student accounts that now belong nowhere (aliases first, then canonical accounts without aliases)
      await tx`DELETE FROM core.accounts a WHERE a.role = 'student' AND a.merged_into IS NOT NULL
                 AND NOT EXISTS (SELECT 1 FROM core.cohort_memberships m WHERE m.account_id = a.id)`;
      await tx`DELETE FROM core.accounts a WHERE a.role = 'student' AND a.merged_into IS NULL
                 AND NOT EXISTS (SELECT 1 FROM core.cohort_memberships m WHERE m.account_id = a.id)
                 AND NOT EXISTS (SELECT 1 FROM core.accounts x WHERE x.merged_into = a.id)`;
      await tx`DELETE FROM core.schema_migrations WHERE scope = ${schema}`;
      await tx`DELETE FROM core.cohorts WHERE id = ${c.id}`;
      await tx`SELECT pg_notify('cohorts_changed', 'delete')`;
    });
    } catch (err) {
      // nothing was dropped (single transaction): put the cohort back the way it was
      await sql`UPDATE core.cohorts SET status = ${c.status}, updated_at = now() WHERE id = ${c.id}`;
      throw err;
    }
    console.log(`deleted cohort ${schema}. Backup: ${file}`);
    return 0;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((c) => process.exit(c), (e) => { console.error(e.message || e); process.exit(1); });
}
