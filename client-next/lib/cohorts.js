import { connection, getCohortConfig, invalidateCohortCache, COHORT_NAME_RE } from '@/lib/db';
import { qid, RESERVED_SCHEMAS, HttpError } from '@/lib/sql-ident';
import { getAccountContext, invalidateAccountCache } from '@/lib/accounts';
import { applyCohortMigrations } from '@/lib/migrator.mjs';
import { createStudent } from '@/lib/student-service';

export { qid };

/** Kept for existing imports: membership data now lives in lib/accounts.js. */
export const invalidateMembershipCache = invalidateAccountCache;

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// ── Request → cohort resolution ───────────────────────────────────────────────

/**
 * Admin without a row in a RUNNING cohort: create membership + users row on demand (one transaction), so every
 * admin can work in every running cohort. Returns the cohort-local users.id to use.
 */
async function ensureAdminInCohort(account, cohort) {
  const schema = qid(cohort.schema);
  const localId = await connection.begin(async (tx) => {
    await tx`INSERT INTO core.cohort_memberships (account_id, cohort_id, status)
             VALUES (${account.id}, ${cohort.id}, 'active') ON CONFLICT DO NOTHING`;
    await tx.unsafe(
      `INSERT INTO ${schema}.users (id, email, password_hash, role, first_name, last_name, is_active, cohort_id)
       VALUES ($1, $2, $3, 'admin', $4, $5, true, $6) ON CONFLICT DO NOTHING`,
      [account.id, account.email, account.password_hash, account.first_name || '', account.last_name || '', cohort.id]);
    const [own] = await tx.unsafe(`SELECT id FROM ${schema}.users WHERE id = $1`, [account.id]);
    if (own) return own.id;
    // The cohort already has a row for this email under another (alias) id: use that one.
    const [byEmail] = await tx.unsafe(`SELECT id FROM ${schema}.users WHERE lower(email) = lower($1)`, [account.email]);
    if (!byEmail) throw new Error('Could not provision admin user in cohort ' + cohort.schema);
    await tx`INSERT INTO core.cohort_memberships (account_id, cohort_id, status)
             VALUES (${byEmail.id}, ${cohort.id}, 'active') ON CONFLICT DO NOTHING`;
    return byEmail.id;
  });
  invalidateAccountCache();
  return localId;
}

/**
 * Decide which cohort a request operates on, and who the caller is inside it.
 *  - admin: any running/archived cohort from the x-cohort header, else the default cohort.
 *  - faculty/student: only cohorts they have a membership in (header if valid, else default if member, else newest).
 *
 * @returns {{ schema, cohort, localId, accountId, role, membership, ctx }}
 */
export async function resolveRequestContext(req, user) {
  const config = await getCohortConfig();
  const ctx = await getAccountContext(user.id);
  if (!ctx) throw new HttpError(401, 'Account not found.');
  if (ctx.account.is_active === false) throw new HttpError(403, 'Account is deactivated.');

  const byName = new Map(config.cohorts.map((c) => [c.schema, c]));
  const requested = req.headers.get('x-cohort');
  const role = ctx.account.role;
  const def = byName.get(config.active);

  let cohort;
  let membership = null;

  if (role === 'admin') {
    cohort = (requested && byName.get(requested)) || def || config.cohorts[config.cohorts.length - 1];
    if (!cohort) throw new HttpError(503, 'No cohort is available.');
    membership = ctx.memberships.find((m) => m.cohort_id === cohort.id) || null;
    if (!membership && cohort.status === 'running') {
      const localId = await ensureAdminInCohort(ctx.account, cohort);
      membership = { local_user_id: localId, cohort_id: cohort.id, schema: cohort.schema, status: 'active' };
    }
  } else {
    const mine = ctx.memberships.filter((m) => byName.has(m.schema)); // oldest -> newest
    if (!mine.length) throw new HttpError(403, 'You are not a member of any cohort.');
    membership =
      (requested && mine.find((m) => m.schema === requested))
      || (def && mine.find((m) => m.cohort_id === def.id))
      || mine[mine.length - 1];
    cohort = byName.get(membership.schema);
  }

  return {
    schema: cohort.schema,
    cohort,
    localId: membership?.local_user_id ?? ctx.canonicalId,
    accountId: ctx.canonicalId,
    role,
    membership,
    ctx,
  };
}

/**
 * Read-only enforcement. Returns an error message when this request must be refused, else null.
 *  - Non-running cohorts accept only GET/HEAD/OPTIONS (unless the route opts in with allowArchivedWrites).
 *  - A student/faculty whose membership is not active (transferred out, withdrawn, completed) is read-only too.
 */
export function readOnlyViolation(method, resolved, { allowArchivedWrites = false } = {}) {
  if (SAFE_METHODS.has(method) || allowArchivedWrites) return null;
  const { cohort, membership, role } = resolved;
  if (cohort.status !== 'running' && cohort.status !== 'provisioning') return 'This cohort is archived and read-only.';
  if (role !== 'admin' && membership && membership.status !== 'active') {
    return `Your membership in this cohort is ${membership.status}; it is read-only.`;
  }
  return null;
}

/**
 * Default cohort for an account at login: the default cohort if they are an active member (admins always get it),
 * else their most recent active membership, else their most recent membership.
 */
export async function defaultCohortForAccount(ctx) {
  const config = await getCohortConfig();
  const def = config.cohorts.find((c) => c.schema === config.active);
  if (ctx.account.role === 'admin') return def?.schema ?? null;
  const mine = [...ctx.memberships].filter((m) => config.schemas.includes(m.schema)).reverse(); // newest first
  if (def && mine.some((m) => m.cohort_id === def.id && m.status === 'active')) return def.schema;
  return (mine.find((m) => m.status === 'active') || mine[0])?.schema ?? null;
}

// ── Cohort lifecycle ──────────────────────────────────────────────────────────

const REFERENCE_TABLES = ['courses', 'categories', 'skills', 'session_types', 'venues', 'system_settings', 'feedback_questions'];

async function commonColumns(q, a, b, table, { exclude = [] } = {}) {
  const rows = await q.unsafe(
    `SELECT ca.column_name FROM information_schema.columns ca
       JOIN information_schema.columns cb ON cb.column_name = ca.column_name AND cb.table_schema = $2 AND cb.table_name = $3
      WHERE ca.table_schema = $1 AND ca.table_name = $3 ORDER BY ca.ordinal_position`, [a, b, table]);
  return rows.map((r) => r.column_name).filter((c) => !exclude.includes(c));
}

async function copyTable(tx, refSchema, dstSchema, table) {
  const cols = (await commonColumns(tx, refSchema, dstSchema, table)).map(qid).join(', ');
  if (!cols) return;
  await tx.unsafe(`INSERT INTO ${qid(dstSchema)}.${qid(table)} (${cols}) SELECT ${cols} FROM ${qid(refSchema)}.${qid(table)}`);
}

function normalizeStudentInput(rows) {
  const seen = new Set();
  const out = [];
  const errors = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    const email = String(r?.email || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errors.push({ email: r?.email || '', error: 'Invalid email' }); continue; }
    if (seen.has(email)) continue;
    seen.add(email);
    const [first, ...rest] = String(r?.name || '').trim().split(/\s+/).filter(Boolean);
    out.push({
      email, firstName: first || email.split('@')[0], lastName: rest.join(' '),
      enrollmentNo: r?.enrollment_no ? String(r.enrollment_no).trim() : null,
      programId: r?.program_id ?? null,
    });
  }
  return { students: out, errors };
}

/** Steps 3.1-3.6: build the cohort inside ONE transaction. Throws on any failure (everything rolls back). */
async function provisionCohort(cohortRow, request) {
  const schemaName = cohortRow.schema_name;
  const result = { schema: schemaName, created: 0, reused: 0, failed: [], tables: 0 };

  await connection.begin(async (tx) => {
    // Serialise with `npm run migrate` (it takes the same advisory lock).
    await tx`SELECT pg_advisory_xact_lock(hashtext('cipd_migrations'))`;

    const [{ exists }] = await tx`SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = ${schemaName}) AS exists`;
    if (exists) throw new HttpError(409, 'A database schema with this name already exists');
    await tx.unsafe(`CREATE SCHEMA ${qid(schemaName)}`);

    // 1. Structure comes from the versioned migrations (no more LIKE-clones: FKs, triggers, sequences are all real).
    const ran = await applyCohortMigrations(connection, schemaName, cohortRow.id, { tx, log: () => {} });
    result.tables = ran.length;
    await tx`SET LOCAL search_path TO core`;

    // 2. Reference data from the reference cohort.
    const [ref] = request.referenceCohortId
      ? await tx`SELECT id, schema_name FROM core.cohorts WHERE id = ${request.referenceCohortId}`
      : await tx`SELECT id, schema_name FROM core.cohorts WHERE is_default LIMIT 1`;
    if (ref) {
      for (const t of REFERENCE_TABLES) await copyTable(tx, ref.schema_name, schemaName, t);
    }

    // 3. Staff: every admin, plus faculty who are active in the reference cohort.
    const dst = qid(schemaName);
    const admins = await tx`SELECT id, email, password_hash, first_name, last_name FROM core.accounts
                             WHERE role = 'admin' AND merged_into IS NULL AND is_active`;
    for (const a of admins) {
      await tx`INSERT INTO core.cohort_memberships (account_id, cohort_id, status) VALUES (${a.id}, ${cohortRow.id}, 'active')`;
      await tx.unsafe(
        `INSERT INTO ${dst}.users (id, email, password_hash, role, first_name, last_name, is_active, cohort_id)
         VALUES ($1, $2, $3, 'admin', $4, $5, true, $6)`,
        [a.id, a.email, a.password_hash, a.first_name || '', a.last_name || '', cohortRow.id]);
    }
    if (ref) {
      const facultyCols = (await commonColumns(tx, ref.schema_name, schemaName, 'faculty', { exclude: ['id'] })).map(qid).join(', ');
      const staff = await tx`
        SELECT a.id, a.email, a.password_hash, a.first_name, a.last_name, m.account_id AS ref_local_id
          FROM core.cohort_memberships m
          JOIN core.accounts a ON a.id = COALESCE((SELECT merged_into FROM core.accounts x WHERE x.id = m.account_id), m.account_id)
         WHERE m.cohort_id = ${ref.id} AND m.status = 'active' AND a.role = 'faculty' AND a.is_active`;
      for (const f of staff) {
        await tx`INSERT INTO core.cohort_memberships (account_id, cohort_id, status) VALUES (${f.id}, ${cohortRow.id}, 'active')`;
        await tx.unsafe(
          `INSERT INTO ${dst}.users (id, email, password_hash, role, first_name, last_name, is_active, cohort_id)
           VALUES ($1, $2, $3, 'faculty', $4, $5, true, $6)`,
          [f.id, f.email, f.password_hash, f.first_name || '', f.last_name || '', cohortRow.id]);
        if (facultyCols) {
          await tx.unsafe(
            `INSERT INTO ${dst}.faculty (id, ${facultyCols}) SELECT $1::uuid, ${facultyCols} FROM ${qid(ref.schema_name)}.faculty WHERE id = $2::uuid`,
            [f.id, f.ref_local_id]);
        }
      }
    }

    // 4. Students: those listed, plus (optionally) the active students of another cohort.
    const { students: listed, errors } = normalizeStudentInput(request.students);
    result.failed.push(...errors);
    const wanted = [...listed];
    if (request.copyActiveStudentsFromCohortId) {
      const [src] = await tx`SELECT id, schema_name FROM core.cohorts WHERE id = ${request.copyActiveStudentsFromCohortId}`;
      if (!src) throw new HttpError(422, 'Cohort to copy students from does not exist.');
      const have = new Set(wanted.map((s) => s.email));
      const rows = await tx.unsafe(
        `SELECT u.email, u.first_name, u.last_name, s.enrollment_no, s.program_id
           FROM ${qid(src.schema_name)}.users u
           JOIN ${qid(src.schema_name)}.students s ON s.id = u.id
           JOIN core.cohort_memberships m ON m.account_id = u.id AND m.cohort_id = ${Number(src.id)} AND m.status = 'active'
          WHERE u.role = 'student' AND u.is_active`);
      for (const r of rows) {
        const email = r.email.toLowerCase();
        if (have.has(email)) continue;
        have.add(email);
        wanted.push({ email, firstName: r.first_name || email.split('@')[0], lastName: r.last_name || '', enrollmentNo: r.enrollment_no, programId: r.program_id });
      }
    }
    for (const s of wanted) {
      try {
        const res = await createStudent({ cohortId: cohortRow.id, ...s }, { tx });
        if (res.created) result.created++; else result.reused++;
      } catch (err) {
        result.failed.push({ email: s.email, error: err.message });
      }
    }

    // 5. Go live.
    if (request.makeDefault) await tx`UPDATE core.cohorts SET is_default = false WHERE is_default`;
    await tx`UPDATE core.cohorts
                SET status = 'running', is_default = ${!!request.makeDefault}, last_error = NULL,
                    provision_request = NULL, updated_at = now()
              WHERE id = ${cohortRow.id}`;
  });
  return result;
}

/** Records a provisioning failure outside the rolled-back transaction. */
async function markFailed(cohortId, err) {
  await connection`UPDATE core.cohorts SET status = 'failed', last_error = ${String(err.message).slice(0, 2000)}, updated_at = now()
                    WHERE id = ${cohortId}`;
  invalidateCohortCache();
}

/**
 * Create a cohort.
 * @param {{ schemaName:string, label:string, program?:string, startsOn?:string, endsOn?:string,
 *           referenceCohortId?:number, students?:{name:string,email:string,enrollment_no?:string,program_id?:number}[],
 *           copyActiveStudentsFromCohortId?:number, makeDefault?:boolean, createdBy?:string }} opts
 */
export async function createCohort(opts) {
  const schemaName = String(opts.schemaName || '').trim();
  const label = String(opts.label || '').trim();
  if (!label) throw new HttpError(400, 'A label is required.');
  if (!COHORT_NAME_RE.test(schemaName) || RESERVED_SCHEMAS.has(schemaName) || schemaName.startsWith('pg_')) {
    throw new HttpError(400, 'Invalid cohort name. Use 3-41 chars: lowercase letters, digits, underscore; must start with a letter.');
  }
  if (opts.startsOn && opts.endsOn && opts.endsOn < opts.startsOn) throw new HttpError(400, 'End date is before the start date.');

  const [dupe] = await connection`SELECT 1 AS x FROM core.cohorts WHERE schema_name = ${schemaName}`;
  if (dupe) throw new HttpError(409, 'A cohort with this name already exists');
  const [ns] = await connection`SELECT 1 AS x FROM pg_namespace WHERE nspname = ${schemaName}`;
  if (ns) throw new HttpError(409, 'A database schema with this name already exists');

  const request = {
    referenceCohortId: opts.referenceCohortId ?? null,
    students: opts.students ?? [],
    copyActiveStudentsFromCohortId: opts.copyActiveStudentsFromCohortId ?? null,
    makeDefault: !!opts.makeDefault,
  };

  // Commit the registry row first so a failure leaves a visible, retryable 'failed' cohort.
  const [row] = await connection`
    INSERT INTO core.cohorts (schema_name, label, program, starts_on, ends_on, status, created_by, provision_request)
    VALUES (${schemaName}, ${label}, ${opts.program || null}, ${opts.startsOn || null}, ${opts.endsOn || null},
            'provisioning', ${opts.createdBy || null}, ${connection.json(request)})
    RETURNING id, schema_name`;

  try {
    const result = await provisionCohort(row, request);
    return { ...result, id: row.id, label, status: 'running' };
  } catch (err) {
    await markFailed(row.id, err);
    throw err instanceof HttpError ? err : new HttpError(500, 'Cohort provisioning failed: ' + err.message);
  } finally {
    invalidateCohortCache();
    invalidateAccountCache();
  }
}

/** Retry a failed provisioning with the originally requested options. */
export async function retryCohort(cohortId) {
  const [row] = await connection`SELECT id, schema_name, status, provision_request FROM core.cohorts WHERE id = ${Number(cohortId) || 0}`;
  if (!row) throw new HttpError(404, 'Cohort not found.');
  if (row.status !== 'failed') throw new HttpError(409, 'Only a failed cohort can be retried.');

  // A failed provisioning rolled back, so there is normally nothing to remove; clean up a half-built schema if one exists.
  await connection.begin(async (tx) => {
    await tx.unsafe(`DROP SCHEMA IF EXISTS ${qid(row.schema_name)} CASCADE`);
    await tx`DELETE FROM core.cohort_memberships WHERE cohort_id = ${row.id}`;
    await tx`DELETE FROM core.schema_migrations WHERE scope = ${row.schema_name}`;
    await tx`UPDATE core.cohorts SET status = 'provisioning', last_error = NULL, updated_at = now() WHERE id = ${row.id}`;
  });
  try {
    const result = await provisionCohort(row, row.provision_request || {});
    return { ...result, id: row.id, status: 'running' };
  } catch (err) {
    await markFailed(row.id, err);
    throw err instanceof HttpError ? err : new HttpError(500, 'Cohort provisioning failed: ' + err.message);
  } finally {
    invalidateCohortCache();
    invalidateAccountCache();
  }
}

/**
 * Edit cohort metadata. `schema_name` is immutable. status may only move running <-> archived.
 * Archiving completes every active membership; un-archiving leaves memberships alone.
 */
export async function updateCohort(cohortId, patch) {
  const out = await connection.begin(async (tx) => {
    const [c] = await tx`SELECT * FROM core.cohorts WHERE id = ${Number(cohortId) || 0} FOR UPDATE`;
    if (!c) throw new HttpError(404, 'Cohort not found.');
    if (patch.schema_name !== undefined && patch.schema_name !== c.schema_name) throw new HttpError(400, 'The schema name cannot be changed.');

    const next = {
      label: patch.label !== undefined ? String(patch.label).trim() : c.label,
      program: patch.program !== undefined ? (patch.program || null) : c.program,
      starts_on: patch.starts_on !== undefined ? (patch.starts_on || null) : c.starts_on,
      ends_on: patch.ends_on !== undefined ? (patch.ends_on || null) : c.ends_on,
      status: c.status,
      is_default: patch.is_default !== undefined ? !!patch.is_default : c.is_default,
    };
    if (!next.label) throw new HttpError(400, 'A label is required.');

    if (patch.status !== undefined && patch.status !== c.status) {
      if (!['running', 'archived'].includes(patch.status) || !['running', 'archived'].includes(c.status)) {
        throw new HttpError(409, `A ${c.status} cohort cannot be changed to ${patch.status}.`);
      }
      next.status = patch.status;
    }
    if (next.status === 'archived' && next.is_default) {
      if (patch.is_default) throw new HttpError(409, 'Only a running cohort can be the default.');
      throw new HttpError(409, 'This is the default cohort. Make another running cohort the default before archiving it.');
    }
    if (next.is_default && c.status !== 'running') throw new HttpError(409, 'Only a running cohort can be the default.');
    if (next.is_default && !c.is_default) await tx`UPDATE core.cohorts SET is_default = false WHERE is_default`;
    if (!next.is_default && c.is_default && patch.is_default === false) {
      throw new HttpError(409, 'There must always be a default cohort. Make another cohort the default instead.');
    }

    try {
      await tx`UPDATE core.cohorts
                  SET label = ${next.label}, program = ${next.program}, starts_on = ${next.starts_on}, ends_on = ${next.ends_on},
                      status = ${next.status}, is_default = ${next.is_default}, updated_at = now()
                WHERE id = ${c.id}`;
    } catch (err) {
      if (err.code === '23514') throw new HttpError(400, 'End date is before the start date.');
      throw err;
    }
    if (next.status === 'archived' && c.status !== 'archived') {
      await tx`UPDATE core.cohort_memberships SET status = 'completed', left_at = COALESCE(left_at, now())
                WHERE cohort_id = ${c.id} AND status = 'active'`;
    }
    return { id: c.id, schema: c.schema_name, ...next };
  });
  invalidateCohortCache();
  invalidateAccountCache();
  return out;
}

/** Compatibility wrapper: makes `schemaName` the default cohort. */
export async function setActiveCohort(schemaName) {
  const { all } = await getCohortConfig();
  const c = all.find((x) => x.schema === schemaName);
  if (!c) throw new HttpError(404, 'Unknown cohort');
  return updateCohort(c.id, { is_default: true });
}

/** All cohorts with member counts, for the admin management page. */
export async function listCohortsForAdmin() {
  const rows = await connection`
    SELECT c.id, c.schema_name AS schema, c.label, c.program, c.starts_on, c.ends_on, c.status, c.is_default, c.is_legacy,
           c.schema_version, c.last_error, c.created_at,
           COALESCE(m.students, 0)::int AS student_count, COALESCE(m.staff, 0)::int AS staff_count
      FROM core.cohorts c
      LEFT JOIN (
        SELECT cm.cohort_id,
               count(*) FILTER (WHERE a.role = 'student' AND cm.status = 'active') AS students,
               count(*) FILTER (WHERE a.role <> 'student' AND cm.status = 'active') AS staff
          FROM core.cohort_memberships cm JOIN core.accounts a ON a.id = cm.account_id
         GROUP BY cm.cohort_id) m ON m.cohort_id = c.id
     ORDER BY c.id`;
  return rows;
}
