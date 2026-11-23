// node scripts/cohort-merge-data.mjs --from <src_schema> --into <dst_schema> --url <DATABASE_URL> [--commit]
//
// Copies every row of cohort schema <from> that is missing from cohort schema <into> (same structure required).
// Policy: the destination wins. Existing destination rows are never updated; a source row is skipped when it
// collides with a destination row on the primary key or on any unique key (ON CONFLICT DO NOTHING).
// Identity: a source user whose id is not in the destination but whose email is, is the same person under a
// per-cohort alias id (see lib/accounts.js); all source references to that id are rewritten to the destination id.
// Source users that are genuinely new get a core.cohort_memberships row for the destination cohort.
// Everything runs in ONE transaction; without --commit it is rolled back after the verification report (dry run).
// The source schema is only read, never modified.
import postgres from 'postgres';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : null)).filter(Boolean));
const { from: SRC, into: DST, url } = args;
const COMMIT = args.commit === true;
if (!SRC || !DST || !url) { console.error('usage: --from <schema> --into <schema> --url <DATABASE_URL> [--commit]'); process.exit(2); }
const qid = (s) => '"' + String(s).replace(/"/g, '""') + '"';
const S = qid(SRC), D = qid(DST);
const USER_TABLES = new Set(['users', 'students', 'faculty']); // all keyed by the user id
const NOTE = `merged from ${SRC} on ${new Date().toISOString().slice(0, 10)}`;

const sql = postgres(url, { max: 1, onnotice: () => {} });
class DryRun extends Error {}
const report = [];
try {
  await sql.begin(async (t) => {
    await t`SET LOCAL lock_timeout = '10s'`;
    const [dstCohort] = await t`SELECT id, status FROM core.cohorts WHERE schema_name = ${DST}`;
    const [srcCohort] = await t`SELECT id, status FROM core.cohorts WHERE schema_name = ${SRC}`;
    if (!dstCohort || !srcCohort) throw new Error('both schemas must be registered cohorts');
    console.log(`source ${SRC} (cohort ${srcCohort.id}, ${srcCohort.status}) -> destination ${DST} (cohort ${dstCohort.id}, ${dstCohort.status})  [${COMMIT ? 'COMMIT' : 'DRY RUN'}]`);

    // ---- identity map: source user id -> destination user id (same person, different per-cohort alias id)
    await t.unsafe(`CREATE TEMP TABLE _idmap ON COMMIT DROP AS
      SELECT s.id AS src, d.id AS dst, s.email FROM ${S}.users s JOIN ${D}.users d ON lower(d.email) = lower(s.email) AND d.id <> s.id
      WHERE NOT EXISTS (SELECT 1 FROM ${D}.users x WHERE x.id = s.id)`);
    const idmap = await t`SELECT m.*, coalesce(a.merged_into, a.id) AS src_canon, coalesce(b.merged_into, b.id) AS dst_canon
      FROM _idmap m LEFT JOIN core.accounts a ON a.id = m.src LEFT JOIN core.accounts b ON b.id = m.dst`;
    for (const m of idmap) {
      if (m.src_canon !== m.dst_canon) throw new Error(`email ${m.email}: ${m.src} and ${m.dst} are different core accounts - resolve manually`);
      console.log(`  identity: ${m.email} ${m.src} -> ${m.dst} (same canonical account ${m.src_canon})`);
    }
    // a source user id already used in the destination by a DIFFERENT email would be a real clash
    const clash = await t.unsafe(`SELECT s.id, s.email, d.email AS dst_email FROM ${S}.users s JOIN ${D}.users d ON d.id = s.id WHERE lower(d.email) <> lower(s.email)`);
    if (clash.length) throw new Error('same user id with different email: ' + JSON.stringify(clash));

    // ---- memberships for genuinely new users
    const [{ status: memberStatus }] = await t`SELECT status FROM core.cohort_memberships WHERE cohort_id = ${dstCohort.id} GROUP BY status ORDER BY count(*) DESC LIMIT 1`;
    const newMembers = await t.unsafe(`INSERT INTO core.cohort_memberships (account_id, cohort_id, status, joined_at, note)
      SELECT s.id, $1, $2, coalesce(m.joined_at, now()), $3 FROM ${S}.users s
      LEFT JOIN core.cohort_memberships m ON m.account_id = s.id AND m.cohort_id = $4
      WHERE NOT EXISTS (SELECT 1 FROM ${D}.users d WHERE d.id = s.id) AND NOT EXISTS (SELECT 1 FROM _idmap i WHERE i.src = s.id)
      ON CONFLICT (account_id, cohort_id) DO NOTHING RETURNING account_id`, [dstCohort.id, memberStatus, NOTE, srcCohort.id]);
    console.log(`  core.cohort_memberships: +${newMembers.length} (status '${memberStatus}') ${newMembers.map((r) => r.account_id).join(', ')}`);

    // ---- tables in FK order
    const tables = (await t`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = ${SRC} AND c.relkind IN ('r','p')`).map((r) => r.relname);
    const fks = await t`SELECT c.relname AS tbl, f.relname AS ref, a.attname AS col, array_length(con.conkey, 1) AS ncols
      FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_class f ON f.oid = con.confrelid JOIN pg_namespace fn ON fn.oid = f.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = con.conkey[1]
      WHERE con.contype = 'f' AND n.nspname = ${SRC} AND fn.nspname = ${SRC}`;
    const order = []; const seen = new Set();
    const visit = (tb, stack = new Set()) => {
      if (seen.has(tb) || stack.has(tb)) return; stack.add(tb);
      for (const f of fks) if (f.tbl === tb && f.ref !== tb) visit(f.ref, stack);
      seen.add(tb); order.push(tb);
    };
    tables.sort().forEach((tb) => visit(tb));
    const userCols = (tb) => new Set(fks.filter((f) => f.tbl === tb && f.ncols === 1 && USER_TABLES.has(f.ref)).map((f) => f.col));

    for (const tb of order) {
      const [{ n: srcRows }] = await t.unsafe(`SELECT count(*)::int AS n FROM ${S}.${qid(tb)}`);
      if (!srcRows) continue;
      const cols = (await t`SELECT column_name, is_generated, identity_generation FROM information_schema.columns WHERE table_schema = ${DST} AND table_name = ${tb} ORDER BY ordinal_position`)
        .filter((c) => c.is_generated !== 'ALWAYS').map((c) => c.column_name);
      const uc = userCols(tb);
      const expr = cols.map((c) => {
        if (tb === 'users' && c === 'cohort_id') return `${dstCohort.id}::smallint`;
        if (uc.has(c)) return `coalesce((SELECT i.dst FROM _idmap i WHERE i.src = x.${qid(c)}), x.${qid(c)})`;
        return `x.${qid(c)}`;
      });
      const skipAliases = USER_TABLES.has(tb) ? `WHERE NOT EXISTS (SELECT 1 FROM _idmap i WHERE i.src = x.id)` : '';
      const ins = await t.unsafe(`INSERT INTO ${D}.${qid(tb)} (${cols.map(qid).join(', ')})
        SELECT ${expr.join(', ')} FROM ${S}.${qid(tb)} x ${skipAliases} ON CONFLICT DO NOTHING`);
      report.push({ table: tb, source_rows: srcRows, inserted: ins.count, skipped_existing: srcRows - ins.count });
    }

    // dedupe keys embed the recipient id ("type:<notification>:<recipient>"); keep them on the destination's id
    const dk = await t.unsafe(`UPDATE ${D}.notification_stream n SET dedupe_key = replace(n.dedupe_key, i.src::text, i.dst::text)
      FROM _idmap i WHERE n.dedupe_key LIKE '%' || i.src::text || '%' AND n.id IN (SELECT id FROM ${S}.notification_stream)`);
    console.log(`  notification_stream dedupe keys re-pointed to destination ids: ${dk.count}`);

    // students inserted above fired trg_auto_enroll_student (enrolled_at = now()); restore the source's enrolment dates
    const fixed = await t.unsafe(`UPDATE ${D}.course_enrollments d SET enrolled_at = s.enrolled_at FROM ${S}.course_enrollments s
      WHERE d.student_id = s.student_id AND d.course_id = s.course_id AND d.enrolled_at <> s.enrolled_at
        AND d.student_id IN (SELECT account_id FROM core.cohort_memberships WHERE cohort_id = ${dstCohort.id} AND note = '${NOTE.replace(/'/g, "''")}')`);
    const extra = await t.unsafe(`SELECT count(*)::int AS n FROM ${D}.course_enrollments d
      WHERE d.student_id IN (SELECT account_id FROM core.cohort_memberships WHERE cohort_id = ${dstCohort.id} AND note = '${NOTE.replace(/'/g, "''")}')
        AND NOT EXISTS (SELECT 1 FROM ${S}.course_enrollments s WHERE s.student_id = d.student_id AND s.course_id = d.course_id)`);
    console.log(`  enrolment dates restored for new students: ${fixed.count}; trigger-only enrolments not in source: ${extra[0].n}`);
    console.table(report);

    // ---- verification: every source row must now be represented in the destination (after id mapping)
    console.log('verification (source rows with no destination counterpart; must all be 0):');
    let bad = 0;
    for (const tb of order) {
      const pk = (await t.unsafe(`SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) WHERE i.indrelid = '${D}.${qid(tb)}'::regclass AND i.indisprimary`)).map((r) => r.attname);
      const uniques = (await t.unsafe(`SELECT array_agg(a.attname ORDER BY k.o) AS cols FROM pg_index i CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY k(n, o)
          JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.n WHERE i.indrelid = '${D}.${qid(tb)}'::regclass AND i.indisunique AND NOT i.indisprimary AND i.indpred IS NULL GROUP BY i.indexrelid`)).map((r) => r.cols);
      const uc = userCols(tb);
      const m = (c) => (uc.has(c) || (USER_TABLES.has(tb) && c === 'id') ? `coalesce((SELECT i.dst FROM _idmap i WHERE i.src = x.${qid(c)}), x.${qid(c)})` : `x.${qid(c)}`);
      const keys = [pk, ...uniques].filter((k) => k.length);
      if (!keys.length) continue;
      const cond = keys.map((k) => `EXISTS (SELECT 1 FROM ${D}.${qid(tb)} d WHERE ${k.map((c) => `d.${qid(c)} = ${m(c)}`).join(' AND ')})`).join(' OR ');
      const [{ n }] = await t.unsafe(`SELECT count(*)::int AS n FROM ${S}.${qid(tb)} x WHERE NOT (${cond})`);
      if (n) { bad += n; console.log(`  ${tb}: ${n} MISSING`); }
    }
    const leftover = idmap.length ? (await t.unsafe(`SELECT count(*)::int AS n FROM (${order.map((tb) => `SELECT 1 FROM ${D}.${qid(tb)} x WHERE to_jsonb(x)::text ~ '${idmap.map((m) => m.src).join('|')}'`).join(' UNION ALL ')}) z`))[0].n : 0;
    console.log(`  rows missing: ${bad}; destination rows still holding an un-mapped alias id: ${leftover}`);
    if (bad || leftover) throw new Error('verification failed - rolled back');
    if (!COMMIT) throw new DryRun();
  });
  console.log('COMMITTED.');
} catch (e) {
  if (e instanceof DryRun) console.log('DRY RUN OK - rolled back, nothing written.');
  else { console.error('ABORTED, rolled back:', e.message); process.exitCode = 1; }
} finally { await sql.end(); }
