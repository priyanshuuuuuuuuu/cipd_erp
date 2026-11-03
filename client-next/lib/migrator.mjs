// SQL migration engine shared by scripts/migrate.mjs (CLI) and lib/cohorts.js (cohort provisioning).
// Plain ESM with no path aliases so it runs under both Node and Next.js.
//
//   migrations/core/NNNN_name.sql    applied once, scope 'core'
//   migrations/cohort/NNNN_name.sql  applied once per cohort schema (scope = schema_name)
//
// Cohort files run in ONE transaction each, after `SET LOCAL search_path TO "<schema>", core`,
// with {{schema}} ("quoted"), {{schema_literal}} ('quoted string') and {{cohort_id}} substituted.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export const MIGRATIONS_ROOT = path.resolve(process.cwd(), 'migrations');
const SCHEMA_RE = /^[a-z][a-z0-9_]{2,40}$/;
const LOCK_KEY = 'cipd_migrations';

const qid = (id) => '"' + String(id).replace(/"/g, '""') + '"';
const lit = (s) => "'" + String(s).replace(/'/g, "''") + "'";

export function assertSchemaName(schema) {
  if (!SCHEMA_RE.test(schema)) throw new Error(`Invalid cohort schema name: ${schema}`);
}

/** Files of one scope, in lexical order, with LF-normalised content and sha256 checksum. */
export async function loadMigrations(scope, root = MIGRATIONS_ROOT) {
  const dir = path.join(root, scope);
  let names;
  try {
    names = (await fs.readdir(dir)).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort();
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  const out = [];
  for (const file of names) {
    const raw = (await fs.readFile(path.join(dir, file), 'utf8')).replace(/\r\n/g, '\n');
    out.push({
      file,
      version: file.slice(0, 4),
      name: file.replace(/\.sql$/, ''),
      sql: raw,
      checksum: crypto.createHash('sha256').update(raw).digest('hex'),
    });
  }
  return out;
}

function render(sqlText, schema, cohortId) {
  return sqlText
    .replaceAll('{{schema_literal}}', lit(schema))
    .replaceAll('{{schema}}', qid(schema))
    .replaceAll('{{cohort_id}}', String(Number(cohortId)));
}

async function ledgerExists(sql) {
  const [{ ok }] = await sql`SELECT to_regclass('core.schema_migrations') IS NOT NULL AS ok`;
  return ok;
}

async function appliedFor(sql, scope) {
  if (!(await ledgerExists(sql))) return new Map();
  const rows = await sql`SELECT version, checksum, executed FROM core.schema_migrations WHERE scope = ${scope}`;
  return new Map(rows.map((r) => [r.version, r]));
}

/** Throws if any already-applied file was edited after being applied. */
function verifyChecksums(scope, files, applied) {
  for (const f of files) {
    const a = applied.get(f.version);
    if (a && a.checksum !== f.checksum) {
      throw new Error(
        `Checksum mismatch for ${scope}/${f.file}: it was edited after being applied. ` +
        `Never edit an applied migration; add a new one.`
      );
    }
  }
}

/**
 * Session-level advisory lock so two deploys cannot migrate concurrently.
 * Held on a reserved connection so the unlock runs on the same session. Returns release().
 */
export async function acquireLock(sql) {
  const conn = await sql.reserve();
  await conn`SELECT pg_advisory_lock(hashtext(${LOCK_KEY}))`;
  return async () => {
    try { await conn`SELECT pg_advisory_unlock(hashtext(${LOCK_KEY}))`; } finally { conn.release(); }
  };
}

export async function applyCoreMigrations(sql, { dryRun = false, log = console.log } = {}) {
  const files = await loadMigrations('core');
  const applied = await appliedFor(sql, 'core');
  verifyChecksums('core', files, applied);
  const ran = [];
  for (const f of files) {
    if (applied.has(f.version)) continue;
    if (dryRun) { log(`[dry-run] core/${f.file}`); ran.push(f.file); continue; }
    await sql.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL search_path TO core, public`);
      await tx.unsafe(f.sql);
      await tx`INSERT INTO core.schema_migrations (scope, version, checksum) VALUES ('core', ${f.version}, ${f.checksum})`;
    });
    log(`applied core/${f.file}`);
    ran.push(f.file);
  }
  return ran;
}

/**
 * Apply all pending cohort migrations for one cohort schema.
 * Safe to call from provisioning code: pass `tx` (an open transaction) to join it instead of starting one.
 */
export async function applyCohortMigrations(sql, schema, cohortId, { dryRun = false, log = console.log, upTo = null, tx = null } = {}) {
  assertSchemaName(schema);
  const files = await loadMigrations('cohort');
  let applied = await appliedFor(sql, schema);
  verifyChecksums(schema, files, applied);

  // Adopt pre-existing cohorts: a schema that already has its tables (public, july, junedecember2026)
  // is, by definition, at the baseline. Record 0001 as applied-without-running instead of re-running it.
  if (!dryRun && !applied.has('0001') && files.some((x) => x.version === '0001')) {
    const [{ has_users }] = await sql`SELECT to_regclass(${qid(schema) + '.users'}) IS NOT NULL AS has_users`;
    if (has_users) {
      await markApplied(sql, schema, '0001');
      log(`adopted ${schema} at baseline 0001 (existing tables, not executed)`);
      applied = await appliedFor(sql, schema);
    }
  }
  const ran = [];
  for (const f of files) {
    if (upTo && f.version > upTo) break;
    if (applied.has(f.version)) continue;
    if (dryRun) { log(`[dry-run] ${schema}/${f.file}`); ran.push(f.file); continue; }
    const body = async (t) => {
      await t.unsafe(`SET LOCAL search_path TO ${qid(schema)}, core`);
      await t.unsafe(render(f.sql, schema, cohortId));
      await t`INSERT INTO core.schema_migrations (scope, version, checksum) VALUES (${schema}, ${f.version}, ${f.checksum})`;
      await t`UPDATE core.cohorts SET schema_version = ${f.version}, updated_at = now() WHERE schema_name = ${schema}`;
    };
    if (tx) {
      await tx.savepoint(body);
    } else {
      await sql.begin(body);
    }
    log(`applied ${schema}/${f.file}`);
    ran.push(f.file);
  }
  return ran;
}

/** Record a cohort migration as applied WITHOUT running it (baseline for pre-existing cohorts). */
export async function markApplied(sql, schema, version) {
  assertSchemaName(schema);
  const files = await loadMigrations('cohort');
  const f = files.find((x) => x.version === version);
  if (!f) throw new Error(`No cohort migration with version ${version}`);
  await sql`
    INSERT INTO core.schema_migrations (scope, version, checksum, executed)
    VALUES (${schema}, ${f.version}, ${f.checksum}, false)
    ON CONFLICT (scope, version) DO NOTHING`;
  await sql`UPDATE core.cohorts SET schema_version = ${f.version}, updated_at = now()
            WHERE schema_name = ${schema} AND (schema_version IS NULL OR schema_version < ${f.version})`;
}

export async function listMigratableCohorts(sql) {
  return sql`SELECT id, schema_name FROM core.cohorts
              WHERE status IN ('running','archived','provisioning') ORDER BY id`;
}
