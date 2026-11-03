// node scripts/check-schema-drift.mjs [--url <DATABASE_URL>] [--cohort <schema>] [--reference <schema>] [--json]
//
// Compares every cohort schema against a reference (default: the newest non-legacy running cohort).
//   non-legacy cohorts : any difference fails (exit 1)
//   legacy cohorts     : tables and columns are STRICT; constraints, indexes and triggers are report-only
// Ignored: _orphans_* tables, public.wifi_snapshots, public.cohorts (legacy registry).
import postgres from 'postgres';
import dotenv from 'dotenv';
import { pathToFileURL } from 'node:url';

dotenv.config({ path: '.env', quiet: true });
dotenv.config({ path: '.env.local', override: false, quiet: true });

const qid = (s) => '"' + s.replace(/"/g, '""') + '"';

function normaliseExpr(expr, schema) {
  if (expr == null) return null;
  return String(expr)
    .replaceAll(`${qid(schema)}.`, '')
    .replaceAll(`${schema}.`, '')
    .replaceAll('extensions.uuid_generate_v4()', 'gen_random_uuid()')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Structural fingerprint of one schema, as maps of key -> normalised description. */
export async function fingerprint(sql, schema) {
  const ign = (t) => t.startsWith('_orphans_') || (schema === 'public' && (t === 'wifi_snapshots' || t === 'cohorts'));

  const tables = (await sql`
    SELECT c.relname AS t FROM pg_class c
     WHERE c.relnamespace = ${schema}::regnamespace AND c.relkind IN ('r','p')`)
    .map((r) => r.t).filter((t) => !ign(t));
  const set = new Set(tables);

  const columns = await sql`
    SELECT c.relname AS t, a.attname AS col, format_type(a.atttypid, a.atttypmod) AS type,
           a.attnotnull AS notnull, pg_get_expr(d.adbin, d.adrelid) AS def, a.attidentity AS ident
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
     WHERE c.relnamespace = ${schema}::regnamespace AND c.relkind IN ('r','p')
       AND a.attnum > 0 AND NOT a.attisdropped`;

  const constraints = await sql`
    SELECT c.relname AS t, k.conname AS name, k.contype AS kind, pg_get_constraintdef(k.oid) AS def
      FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid
     WHERE c.relnamespace = ${schema}::regnamespace`;

  const indexes = await sql`
    SELECT tablename AS t, indexname AS name, indexdef AS def FROM pg_indexes WHERE schemaname = ${schema}`;

  const triggers = await sql`
    SELECT c.relname AS t, g.tgname AS name, pg_get_triggerdef(g.oid) AS def
      FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid
     WHERE c.relnamespace = ${schema}::regnamespace AND NOT g.tgisinternal`;

  const fp = { tables: new Map(), columns: new Map(), constraints: new Map(), indexes: new Map(), triggers: new Map() };
  for (const t of tables) fp.tables.set(t, 'table');
  for (const r of columns) {
    if (!set.has(r.t)) continue;
    // serial/identity are interchangeable only if identical; we keep them strict
    // users.cohort_id's default is this cohort's own id: compare its presence, not its value
    const def = r.t === 'users' && r.col === 'cohort_id' ? '<cohort_id>' : (normaliseExpr(r.def, schema) ?? '');
    fp.columns.set(`${r.t}.${r.col}`, `${r.type}|${r.notnull ? 'NOT NULL' : 'null'}|${def}|${r.ident || ''}`);
  }
  for (const r of constraints) {
    if (!set.has(r.t)) continue;
    // users_cohort_is_this embeds this cohort's own id
    const def = r.name === 'users_cohort_is_this' ? 'CHECK (cohort_id = <cohort_id>)' : normaliseExpr(r.def, schema);
    fp.constraints.set(`${r.t}.${r.name}`, `${r.kind}|${def}`);
  }
  for (const r of indexes) if (set.has(r.t)) fp.indexes.set(`${r.t}.${r.name}`, normaliseExpr(r.def, schema));
  for (const r of triggers) if (set.has(r.t)) fp.triggers.set(`${r.t}.${r.name}`, normaliseExpr(r.def, schema));
  return fp;
}

function diffMaps(kind, ref, other) {
  const out = [];
  for (const [k, v] of ref) {
    if (!other.has(k)) out.push({ kind, key: k, problem: 'missing', expected: v });
    else if (other.get(k) !== v) out.push({ kind, key: k, problem: 'different', expected: v, actual: other.get(k) });
  }
  for (const [k, v] of other) if (!ref.has(k)) out.push({ kind, key: k, problem: 'extra', actual: v });
  return out;
}

const STRICT_ALWAYS = new Set(['tables', 'columns']);

export async function checkDrift(sql, { only = null, reference = null } = {}) {
  const cohorts = await sql`SELECT schema_name, is_legacy, status FROM core.cohorts
                             WHERE status IN ('running','archived','provisioning') ORDER BY id`;
  const ref = reference
    || [...cohorts].reverse().find((c) => !c.is_legacy && c.status === 'running')?.schema_name;
  if (!ref) throw new Error('No reference cohort (need a non-legacy running cohort or --reference)');
  const refFp = await fingerprint(sql, ref);

  const report = [];
  for (const c of cohorts) {
    if (c.schema_name === ref || (only && c.schema_name !== only)) continue;
    const fp = await fingerprint(sql, c.schema_name);
    const diffs = [];
    for (const kind of Object.keys(refFp)) diffs.push(...diffMaps(kind, refFp[kind], fp[kind]));
    const strict = diffs.filter((d) => !c.is_legacy || STRICT_ALWAYS.has(d.kind));
    const info = diffs.filter((d) => !strict.includes(d));
    report.push({ schema: c.schema_name, legacy: c.is_legacy, reference: ref, strict, info });
  }
  return report;
}

async function main() {
  const argv = process.argv.slice(2);
  const opt = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  const url = opt('url') || process.env.DATABASE_URL;
  if (!url) { console.error('DATABASE_URL (or --url) is required'); return 2; }
  const sql = postgres(url, { max: 1, prepare: false });
  try {
    const report = await checkDrift(sql, { only: opt('cohort'), reference: opt('reference') });
    if (argv.includes('--json')) { console.log(JSON.stringify(report, null, 2)); }
    let failed = false;
    for (const r of report) {
      const status = r.strict.length ? 'FAIL' : 'ok';
      if (r.strict.length) failed = true;
      if (!argv.includes('--json')) {
        console.log(`${status.padEnd(4)} ${r.schema}${r.legacy ? ' (legacy)' : ''} vs ${r.reference}: ${r.strict.length} strict, ${r.info.length} report-only`);
        for (const d of r.strict) console.log(`   STRICT ${d.kind} ${d.key}: ${d.problem}${d.expected ? ` expected=${d.expected}` : ''}${d.actual ? ` actual=${d.actual}` : ''}`);
        if (argv.includes('--verbose')) for (const d of r.info) console.log(`   info   ${d.kind} ${d.key}: ${d.problem}`);
      }
    }
    return failed ? 1 : 0;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((c) => process.exit(c), (e) => { console.error(e); process.exit(1); });
}
