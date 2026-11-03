// node scripts/backfill-identity.mjs [--url <DATABASE_URL>] [--apply] [--allow-unresolved]
//
// Loads core.accounts / core.cohort_memberships / core.programs from the existing per-cohort users/students rows.
//   default      DRY RUN: prints the plan and every conflict, writes nothing
//   --apply      writes everything in ONE transaction (idempotent: re-running changes nothing that already exists)
//
// Rules
//  * Rows with the same users.id are one account. Ids that share an email (case-insensitive) are the same person:
//    the canonical id is the one present in the most recent cohort; the others become aliases (merged_into).
//    Historical ids are never changed. Every such case is recorded in core.account_conflicts for an admin to review.
//  * password_hash / names / is_active / role come from the canonical id's row in the most recent cohort it belongs to.
//  * One membership per (users row, cohort): 'active' in a running cohort, 'completed' in an archived one,
//    'withdrawn' for an inactive users row in a running cohort.
//  * Programs are normalised into core.programs; students.program_name is NEVER rewritten.
//  * Run twice: once before `npm run migrate` applies cohort/0003 (accounts + memberships), once after (program_id).
import postgres from 'postgres';
import dotenv from 'dotenv';
import { pathToFileURL } from 'node:url';

dotenv.config({ path: '.env', quiet: true });
dotenv.config({ path: '.env.local', override: false, quiet: true });

const qid = (s) => '"' + String(s).replace(/"/g, '""') + '"';

// raw (lower-cased, trimmed) program_name -> canonical program. Reviewable; extend as needed.
export const PROGRAM_MAP = new Map([
  ['ipd-cp', 'iPD-CP'], ['ipdcp', 'iPD-CP'], ['ipdcp 2026', 'iPD-CP'],
  ['b.tech', 'B.Tech CSE'], ['b.tech cse', 'B.Tech CSE'],
]);

export function normaliseProgram(raw) {
  const t = (raw ?? '').trim();
  if (!t) return null;
  return PROGRAM_MAP.get(t.toLowerCase()) ?? t; // unknown values are kept as their own program
}

/** Pure planning step: rows -> accounts, memberships, conflicts. `cohorts` must be ordered oldest -> newest. */
export function buildPlan(cohorts, rows) {
  const rank = new Map(cohorts.map((c, i) => [c.id, i]));
  const byId = new Map(); // id -> rows (newest first)
  for (const r of rows) {
    if (!byId.has(r.id)) byId.set(r.id, []);
    byId.get(r.id).push(r);
  }
  for (const list of byId.values()) list.sort((a, b) => rank.get(b.cohort_id) - rank.get(a.cohort_id));

  // union-find over ids that share any email
  const parent = new Map([...byId.keys()].map((id) => [id, id]));
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(rb, ra); };
  const emailOwner = new Map();
  for (const [id, list] of byId) {
    for (const r of list) {
      const e = (r.email || '').trim().toLowerCase();
      if (!e) continue;
      if (emailOwner.has(e)) union(emailOwner.get(e), id); else emailOwner.set(e, id);
    }
  }
  const groups = new Map();
  for (const id of byId.keys()) {
    const root = find(id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(id);
  }

  const conflicts = [];
  const accounts = []; // canonical first, then aliases
  const aliasAccounts = [];
  const cohortName = new Map(cohorts.map((c) => [c.id, c.schema_name]));

  for (const ids of groups.values()) {
    const primary = (id) => byId.get(id)[0];
    const sorted = [...ids].sort((a, b) => {
      const d = rank.get(primary(b).cohort_id) - rank.get(primary(a).cohort_id);
      if (d) return d;
      const t = new Date(primary(a).created_at) - new Date(primary(b).created_at);
      return t || (a < b ? -1 : 1);
    });
    const canonicalId = sorted[0];
    const canon = primary(canonicalId);
    const roles = new Set(ids.map((id) => primary(id).role));

    if (ids.length > 1) {
      conflicts.push({
        kind: roles.size > 1 ? 'role_mismatch' : 'email_split_id',
        details: {
          email: (canon.email || '').toLowerCase(),
          canonical: canonicalId,
          role: [...roles].join('/'),
          ids: sorted.map((id) => ({
            id,
            cohorts: byId.get(id).map((r) => cohortName.get(r.cohort_id)),
            same_password_as_canonical: primary(id).password_hash === canon.password_hash,
          })),
        },
        blocking: roles.size > 1,
      });
    }

    // enrollment number: newest non-null across the canonical's own rows
    const enrollment = byId.get(canonicalId).map((r) => r.enrollment_no).find((e) => e && e.trim()) || null;

    accounts.push({
      id: canonicalId, merged_into: null, email: (canon.email || '').trim(), password_hash: canon.password_hash,
      role: canon.role, first_name: canon.first_name, last_name: canon.last_name,
      enrollment_no: enrollment ? enrollment.trim() : null, is_active: canon.is_active ?? true,
      created_at: byId.get(canonicalId).at(-1).created_at,
    });

    for (const id of sorted.slice(1)) {
      if (roles.size > 1) { // never alias across roles: leave as a standalone account and flag it
        continue;
      }
      const p = primary(id);
      const e = byId.get(id).map((r) => r.enrollment_no).find((x) => x && x.trim()) || null;
      aliasAccounts.push({
        id, merged_into: canonicalId, email: (p.email || '').trim(), password_hash: p.password_hash, role: p.role,
        first_name: p.first_name, last_name: p.last_name, enrollment_no: e ? e.trim() : null,
        is_active: p.is_active ?? true, created_at: byId.get(id).at(-1).created_at,
      });
    }
  }

  // enrollment-number collisions among canonical accounts
  const seen = new Map();
  for (const a of accounts) {
    if (!a.enrollment_no) continue;
    if (seen.has(a.enrollment_no)) {
      conflicts.push({ kind: 'enrollment_collision', details: { enrollment_no: a.enrollment_no, accounts: [seen.get(a.enrollment_no), a.id] }, blocking: false });
      a.enrollment_no = null;
    } else {
      seen.set(a.enrollment_no, a.id);
    }
  }

  // an id whose email differs between cohorts (informational)
  for (const [id, list] of byId) {
    const emails = new Set(list.map((r) => (r.email || '').toLowerCase()));
    if (emails.size > 1) conflicts.push({ kind: 'email_changed', details: { id, emails: [...emails] }, blocking: false });
  }

  const memberships = rows.map((r) => {
    const c = cohorts.find((x) => x.id === r.cohort_id);
    const status = c.status === 'running' ? (r.is_active === false ? 'withdrawn' : 'active') : 'completed';
    return { account_id: r.id, cohort_id: r.cohort_id, status, joined_at: r.created_at };
  });

  const programs = [...new Set(rows.map((r) => normaliseProgram(r.program_name)).filter(Boolean))].sort();
  return { accounts: [...accounts, ...aliasAccounts], memberships, programs, conflicts };
}

async function loadRows(sql, cohorts) {
  const rows = [];
  for (const c of cohorts) {
    const part = await sql.unsafe(`
      SELECT u.id, u.email, u.password_hash, u.role, u.first_name, u.last_name, u.is_active, u.created_at,
             s.enrollment_no, s.program_name
        FROM ${qid(c.schema_name)}.users u
        LEFT JOIN ${qid(c.schema_name)}.students s ON s.id = u.id`);
    for (const r of part) rows.push({ ...r, cohort_id: c.id });
  }
  return rows;
}

async function main() {
  const argv = process.argv.slice(2);
  const opt = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  const apply = argv.includes('--apply');
  const url = opt('url') || process.env.DATABASE_URL;
  if (!url) { console.error('DATABASE_URL (or --url) is required'); return 2; }
  try { const u = new URL(url); console.log(`target: ${u.hostname}:${u.port || 5432}${u.pathname}  mode: ${apply ? 'APPLY' : 'dry run'}`); } catch { /* ignore */ }

  const sql = postgres(url, { max: 2, prepare: false });
  try {
    const cohorts = await sql`
      SELECT id, schema_name, status, starts_on FROM core.cohorts
       WHERE status IN ('running','archived') ORDER BY starts_on NULLS FIRST, id`;
    const rows = await loadRows(sql, cohorts);
    const plan = buildPlan(cohorts, rows);

    const canonical = plan.accounts.filter((a) => !a.merged_into);
    console.log(`cohorts: ${cohorts.map((c) => c.schema_name).join(' < ')}`);
    console.log(`users rows: ${rows.length}  ->  accounts: ${plan.accounts.length} (canonical ${canonical.length}, aliases ${plan.accounts.length - canonical.length})`);
    console.log(`memberships: ${plan.memberships.length}  programs: ${plan.programs.join(', ') || '(none)'}`);
    console.log(`conflicts: ${plan.conflicts.length}`);
    for (const c of plan.conflicts) console.log(`  [${c.blocking ? 'BLOCKING' : 'review'}] ${c.kind} ${JSON.stringify(c.details)}`);

    const blocking = plan.conflicts.filter((c) => c.blocking);
    if (blocking.length && !argv.includes('--allow-unresolved')) {
      console.error(`\n${blocking.length} blocking conflict(s). Resolve them or re-run with --allow-unresolved.`);
      return apply ? 1 : 0;
    }
    if (!apply) { console.log('\ndry run: nothing written. Re-run with --apply to write.'); return 0; }

    await sql.begin(async (tx) => {
      // canonical accounts first, then aliases (FK merged_into)
      for (const a of plan.accounts.filter((x) => !x.merged_into).concat(plan.accounts.filter((x) => x.merged_into))) {
        await tx`
          INSERT INTO core.accounts (id, merged_into, email, password_hash, role, first_name, last_name, enrollment_no, is_active, created_at)
          VALUES (${a.id}, ${a.merged_into}, ${a.email}, ${a.password_hash}, ${a.role}, ${a.first_name}, ${a.last_name}, ${a.enrollment_no}, ${a.is_active}, ${a.created_at ?? new Date()})
          ON CONFLICT (id) DO NOTHING`;
      }
      for (const m of plan.memberships) {
        await tx`
          INSERT INTO core.cohort_memberships (account_id, cohort_id, status, joined_at)
          VALUES (${m.account_id}, ${m.cohort_id}, ${m.status}, ${m.joined_at ?? new Date()})
          ON CONFLICT (account_id, cohort_id) DO NOTHING`;
      }
      for (const name of plan.programs) {
        await tx`INSERT INTO core.programs (name) VALUES (${name}) ON CONFLICT (name) DO NOTHING`;
      }
      for (const c of plan.conflicts) {
        // keep one open row per distinct finding so re-runs do not pile up duplicates
        await tx`
          INSERT INTO core.account_conflicts (kind, details)
          SELECT ${c.kind}, ${tx.json(c.details)}
           WHERE NOT EXISTS (SELECT 1 FROM core.account_conflicts WHERE kind = ${c.kind} AND details = ${tx.json(c.details)})`;
      }

      // students.program_id exists only after cohort/0003: fill it from the normalised names when present.
      const programRows = await tx`SELECT id, name FROM core.programs`;
      const programId = new Map(programRows.map((p) => [p.name, p.id]));
      for (const c of cohorts) {
        const [{ has }] = await tx.unsafe(
          `SELECT EXISTS (SELECT 1 FROM information_schema.columns
                           WHERE table_schema = $1 AND table_name = 'students' AND column_name = 'program_id') AS has`, [c.schema_name]);
        if (!has) continue;
        const names = await tx.unsafe(`SELECT DISTINCT program_name FROM ${qid(c.schema_name)}.students WHERE program_id IS NULL AND program_name IS NOT NULL`);
        for (const { program_name } of names) {
          const norm = normaliseProgram(program_name);
          if (!norm || !programId.has(norm)) continue;
          await tx.unsafe(`UPDATE ${qid(c.schema_name)}.students SET program_id = $1 WHERE program_id IS NULL AND program_name = $2`, [programId.get(norm), program_name]);
        }
      }
    });
    console.log('\napplied.');
    return 0;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((c) => process.exit(c), (e) => { console.error(e); process.exit(1); });
}
