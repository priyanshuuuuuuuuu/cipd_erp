import crypto from 'node:crypto';
import { connection, getCohortConfig, invalidateCohortCache, COHORT_NAME_RE } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

const RESERVED_SCHEMAS = new Set([
  'public', 'auth', 'storage', 'vault', 'realtime', 'extensions',
  'graphql', 'graphql_public', 'information_schema', 'pgbouncer',
]);

// Tables never cloned into a new cohort. wifi_snapshots stays a single shared table in `public`.
const SKIP_TABLES = new Set(['wifi_snapshots']);

// Reference tables copied (in FK-safe order). `users` and `faculty` are handled separately.
// session_skills is intentionally NOT copied: its rows only link sessions to skills and a fresh
// cohort has no sessions, so the copied rows would be orphans.
const COPY_TABLES = [
  'courses',
  'categories',
  'skills',
  'session_types',
  'venues',
  'system_settings',
  'feedback_questions',
  'google_tokens',
];

/** Quote a (pre-validated) identifier for use in dynamic SQL. */
export function qid(id) {
  return '"' + String(id).replace(/"/g, '""') + '"';
}

// ── Student → cohort membership ──────────────────────────────────────────────
const MEMBERSHIP_TTL_MS = 60_000;
const _membershipCache = new Map(); // userId -> { at, cohorts }

export function invalidateMembershipCache() {
  _membershipCache.clear();
}

/**
 * Cohorts (in registry order, oldest first) in which `userId` has a users row.
 * Cached briefly so it can be used on every request.
 */
export async function getUserCohorts(userId) {
  const hit = _membershipCache.get(userId);
  if (hit && Date.now() - hit.at < MEMBERSHIP_TTL_MS) return hit.cohorts;

  const { schemas } = await getCohortConfig(); // validated registry names only
  if (!schemas.length) return [];
  const query = schemas
    .map((s, i) => `SELECT ${i} AS idx FROM ${qid(s)}.users WHERE id = $1`)
    .join(' UNION ALL ');
  const rows = await connection.unsafe(query, [userId]);
  const cohorts = rows.map(r => schemas[Number(r.idx)]).filter(Boolean);
  _membershipCache.set(userId, { at: Date.now(), cohorts });
  return cohorts;
}

/**
 * Decide which cohort schema a request operates on.
 *  - admin/faculty: x-cohort header if registered, else the active cohort.
 *  - student: x-cohort header if they belong to it; otherwise the active cohort if they belong
 *    to it; otherwise the most recent cohort they belong to.
 */
export async function resolveRequestSchema(req, user) {
  const { schemas, active } = await getCohortConfig();
  const requested = req.headers.get('x-cohort');

  if (user.role !== 'student') {
    return requested && schemas.includes(requested) ? requested : active;
  }

  let members = [];
  try {
    members = await getUserCohorts(user.id);
  } catch (err) {
    console.error('resolveRequestSchema: membership lookup failed:', err.message);
  }
  if (requested && members.includes(requested)) return requested;
  if (members.includes(active)) return active;
  if (members.length) return members[members.length - 1];
  return active;
}

/** Default cohort for a user at login time, from the cohorts they belong to. */
export function pickDefaultCohort(role, members, active) {
  if (members.includes(active)) return active;
  if (!members.length) return null;
  return role === 'student' ? members[members.length - 1] : members[0];
}

// ── Create a new cohort ──────────────────────────────────────────────────────
function normalizeStudents(rows) {
  const seen = new Set();
  const out = [];
  const errors = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    const email = String(r?.email || '').trim().toLowerCase();
    const name = String(r?.name || '').trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ email: r?.email || '', error: 'Invalid email' });
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    const [first, ...rest] = name.split(/\s+/).filter(Boolean);
    out.push({
      email,
      firstName: first || email.split('@')[0],
      lastName: rest.join(' '),
      enrollmentNo: r?.enrollment_no ? String(r.enrollment_no).trim() : null,
      programName: r?.program_name ? String(r.program_name).trim() : null,
    });
  }
  return { students: out, errors };
}

/**
 * Creates a fresh cohort schema by cloning the structure of `sourceSchema`, copying reference data
 * and non-student users, and enrolling the provided students. Everything runs in one transaction.
 *
 * @param {{ schemaName: string, label: string, students?: {name:string,email:string}[],
 *           makeActive?: boolean, createdBy?: string, sourceSchema?: string }} opts
 */
export async function createCohort(opts) {
  const schemaName = String(opts.schemaName || '').trim();
  const label = String(opts.label || '').trim() || schemaName.charAt(0).toUpperCase() + schemaName.slice(1);

  if (!COHORT_NAME_RE.test(schemaName) || RESERVED_SCHEMAS.has(schemaName) || schemaName.startsWith('pg_')) {
    const err = new Error('Invalid cohort name. Use 3-41 chars: lowercase letters, digits, underscore; must start with a letter.');
    err.status = 400;
    throw err;
  }

  const { schemas, active } = await getCohortConfig();
  if (schemas.includes(schemaName)) {
    const err = new Error('A cohort with this name already exists');
    err.status = 409;
    throw err;
  }
  const source = opts.sourceSchema || active;
  if (!schemas.includes(source)) {
    const err = new Error('Invalid source cohort');
    err.status = 400;
    throw err;
  }

  const { students: studentRows, errors: inputErrors } = normalizeStudents(opts.students);

  // Existing identities (same email in any other cohort) are reused so one person keeps one account.
  const existingByEmail = new Map();
  if (studentRows.length) {
    const emails = studentRows.map(s => s.email);
    for (const s of schemas) {
      const rows = await connection.unsafe(
        `SELECT id, email, password_hash, first_name, last_name, preferences
         FROM ${qid(s)}.users WHERE lower(email) = ANY($1) AND role = 'student'`,
        [emails]
      );
      for (const r of rows) {
        if (!existingByEmail.has(r.email.toLowerCase())) existingByEmail.set(r.email.toLowerCase(), r);
      }
    }
  }

  const src = qid(source);
  const dst = qid(schemaName);
  const result = { schema: schemaName, label, created: 0, reused: 0, failed: [...inputErrors], tables: 0 };

  await connection.begin(async (sql) => {
    const [{ exists }] = await sql.unsafe(
      `SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = $1) AS exists`, [schemaName]
    );
    if (exists) {
      const err = new Error('A database schema with this name already exists');
      err.status = 409;
      throw err;
    }

    await sql.unsafe(`CREATE SCHEMA ${dst}`);

    // 1. Clone table structure (columns, defaults, PK/unique/check constraints, indexes).
    const tables = (await sql.unsafe(
      `SELECT c.relname AS name, c.relrowsecurity AS rls
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = $1 AND c.relkind = 'r' ORDER BY c.relname`, [source]
    )).filter(t => !SKIP_TABLES.has(t.name));

    for (const t of tables) {
      await sql.unsafe(`CREATE TABLE ${dst}.${qid(t.name)} (LIKE ${src}.${qid(t.name)} INCLUDING ALL)`);
      if (t.rls) await sql.unsafe(`ALTER TABLE ${dst}.${qid(t.name)} ENABLE ROW LEVEL SECURITY`);
    }
    result.tables = tables.length;

    // 2. Recreate foreign keys (LIKE does not copy them), re-pointed at the new schema.
    await sql.unsafe(`SET LOCAL search_path TO ${src}, public`);
    const fks = await sql.unsafe(
      `SELECT conrelid::regclass::text AS tbl, conname, pg_get_constraintdef(oid) AS def
       FROM pg_constraint WHERE contype = 'f' AND connamespace = $1::regnamespace`, [source]
    );
    await sql.unsafe(`SET LOCAL search_path TO ${dst}, public`);
    const srcPrefix = new RegExp(`REFERENCES\\s+"?${source}"?\\.`, 'g');
    for (const fk of fks) {
      const tbl = fk.tbl.replace(/^"?[^".]+"?\./, '').replace(/"/g, '');
      if (SKIP_TABLES.has(tbl)) continue;
      const def = fk.def.replace(srcPrefix, 'REFERENCES ');
      await sql.unsafe(`ALTER TABLE ${dst}.${qid(tbl)} ADD CONSTRAINT ${qid(fk.conname)} ${def}`);
    }
    await sql.unsafe(`SET LOCAL search_path TO public`);

    // 3. Copy non-student users and their faculty rows, then reference tables.
    await sql.unsafe(`INSERT INTO ${dst}.users SELECT * FROM ${src}.users WHERE role <> 'student'`);
    await sql.unsafe(`INSERT INTO ${dst}.faculty SELECT * FROM ${src}.faculty WHERE id IN (SELECT id FROM ${dst}.users)`);
    for (const t of COPY_TABLES) {
      await sql.unsafe(`INSERT INTO ${dst}.${qid(t)} SELECT * FROM ${src}.${qid(t)}`);
    }

    // 4. Enrol students.
    for (const s of studentRows) {
      try {
        await sql.savepoint(async (sp) => {
          const prev = existingByEmail.get(s.email);
          let id;
          if (prev) {
            id = prev.id;
            await sp.unsafe(
              `INSERT INTO ${dst}.users (id, email, password_hash, role, first_name, last_name, is_active, preferences)
               VALUES ($1, $2, $3, 'student', $4, $5, true, $6)`,
              [prev.id, s.email, prev.password_hash, prev.first_name, prev.last_name, prev.preferences ?? null]
            );
            result.reused++;
          } else {
            // Random password: the student sets their own via "Forgot password".
            const hash = await hashPassword(crypto.randomBytes(24).toString('base64url'));
            const [row] = await sp.unsafe(
              `INSERT INTO ${dst}.users (email, password_hash, role, first_name, last_name, is_active)
               VALUES ($1, $2, 'student', $3, $4, true) RETURNING id`,
              [s.email, hash, s.firstName, s.lastName]
            );
            id = row.id;
            result.created++;
          }
          await sp.unsafe(
            `INSERT INTO ${dst}.students (id, enrollment_no, program_name) VALUES ($1, $2, $3)`,
            [id, s.enrollmentNo, s.programName]
          );
        });
      } catch (err) {
        result.failed.push({ email: s.email, error: err.message });
      }
    }

    // 5. Register the cohort.
    if (opts.makeActive) await sql.unsafe(`UPDATE public.cohorts SET is_active = false WHERE is_active`);
    await sql.unsafe(
      `INSERT INTO public.cohorts (schema_name, label, is_active, created_by) VALUES ($1, $2, $3, $4)`,
      [schemaName, label, !!opts.makeActive, opts.createdBy || null]
    );
  });

  invalidateCohortCache();
  invalidateMembershipCache();
  return result;
}

/** Marks `schemaName` as the single active cohort. */
export async function setActiveCohort(schemaName) {
  const { schemas } = await getCohortConfig();
  if (!schemas.includes(schemaName)) {
    const err = new Error('Unknown cohort');
    err.status = 404;
    throw err;
  }
  await connection.begin(async (sql) => {
    await sql`UPDATE public.cohorts SET is_active = false WHERE is_active`;
    await sql`UPDATE public.cohorts SET is_active = true WHERE schema_name = ${schemaName}`;
  });
  invalidateCohortCache();
}
