import { randomUUID } from 'node:crypto';
import { connection, getCohortConfig, onCacheInvalidate, invalidateCohortCache } from '@/lib/db';

/**
 * Central identity (core.accounts / core.cohort_memberships).
 *
 * One canonical account per person. Legacy duplicates of the same person (different ids in different cohorts)
 * are alias accounts with `merged_into = <canonical id>`; historical ids never change because every cohort table
 * references the cohort-local users.id.
 */

const TTL_MS = 60_000;
const g = globalThis;
if (!g._accountCtxCache) g._accountCtxCache = new Map(); // any account id -> { at, ctx }
const cache = g._accountCtxCache;

// Local-only clear, called by db.js whenever ANY cache invalidation happens (here or via NOTIFY from another process).
onCacheInvalidate(() => cache.clear());

/** Call after any change to accounts, memberships or cohorts: clears this process and tells the others. */
export function invalidateAccountCache() {
  invalidateCohortCache();
}

/**
 * Everything needed to authorise a request for the person behind `anyAccountId` (canonical or alias).
 * @returns {Promise<null | {
 *   canonicalId: string, account: object, aliasIds: string[],
 *   memberships: Array<{ cohort_id:number, schema:string, cohort_status:string, status:string, local_user_id:string }>
 * }>}
 */
export async function getAccountContext(anyAccountId) {
  const hit = cache.get(anyAccountId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.ctx;

  const [row] = await connection`SELECT id, merged_into FROM core.accounts WHERE id = ${anyAccountId}`;
  if (!row) return null;
  const canonicalId = row.merged_into || row.id;

  const [account] = await connection`SELECT id, merged_into, email, password_hash, role, first_name, last_name, enrollment_no, is_active
                                   FROM core.accounts WHERE id = ${canonicalId}`;
  if (!account) return null;
  const aliases = await connection`SELECT id FROM core.accounts WHERE merged_into = ${canonicalId}`;
  const aliasIds = aliases.map((a) => a.id);
  const ids = [canonicalId, ...aliasIds];

  const memberships = await connection`
    SELECT m.account_id AS local_user_id, m.cohort_id, c.schema_name AS schema, c.status AS cohort_status, m.status
      FROM core.cohort_memberships m
      JOIN core.cohorts c ON c.id = m.cohort_id
     WHERE m.account_id IN ${connection(ids)}
     ORDER BY m.cohort_id`;

  const ctx = { canonicalId, account, aliasIds, memberships };
  cache.set(anyAccountId, { at: Date.now(), ctx });
  return ctx;
}

/** Memberships of a person, newest cohort first. */
export async function getMemberships(anyAccountId) {
  const ctx = await getAccountContext(anyAccountId);
  return ctx ? [...ctx.memberships].reverse() : [];
}

/**
 * Find the canonical account for a login identifier (email, or enrollment number for students).
 * Returns { account, aliasAccounts } where aliasAccounts are the other ids of the same person (their password
 * hashes are accepted too, so people who last changed their password under an older id are not locked out).
 */
export async function findCanonicalAccountByLogin(identifier) {
  const value = String(identifier || '').trim();
  if (!value) return null;

  let seed = null;
  if (value.includes('@')) {
    [seed] = await connection`SELECT id, merged_into FROM core.accounts WHERE lower(email) = ${value.toLowerCase()} ORDER BY merged_into NULLS FIRST LIMIT 1`;
  } else {
    [seed] = await connection`SELECT id, merged_into FROM core.accounts WHERE enrollment_no = ${value} AND role = 'student' ORDER BY merged_into NULLS FIRST LIMIT 1`;
    if (!seed) {
      // fall back to the students tables of the running cohorts
      const { cohorts } = await getCohortConfig();
      for (const c of cohorts.filter((x) => x.status === 'running')) {
        const rows = await connection.unsafe(
          `SELECT id FROM "${c.schema.replace(/"/g, '""')}".students WHERE enrollment_no = $1 LIMIT 1`, [value]);
        if (rows[0]) { seed = { id: rows[0].id, merged_into: null }; break; }
      }
    }
  }
  if (!seed) return null;

  const ctx = await getAccountContext(seed.id);
  if (!ctx) return null;
  const aliasAccounts = ctx.aliasIds.length
    ? await connection`SELECT id, password_hash FROM core.accounts WHERE id IN ${connection(ctx.aliasIds)}`
    : [];
  return { account: ctx.account, aliasAccounts, ctx };
}

/**
 * Update identity fields and mirror them to the users rows of RUNNING cohorts. Archived cohorts keep their
 * historical values.
 * @param {string} canonicalId
 * @param {{ first_name?: string, last_name?: string, email?: string, is_active?: boolean, enrollment_no?: string|null }} patch
 */
export async function updateAccount(canonicalId, patch) {
  const ctx = await getAccountContext(canonicalId);
  if (!ctx) throw Object.assign(new Error('Account not found'), { status: 404 });

  const next = {
    first_name: patch.first_name ?? ctx.account.first_name,
    last_name: patch.last_name ?? ctx.account.last_name,
    email: patch.email !== undefined ? String(patch.email).trim().toLowerCase() : ctx.account.email,
    is_active: patch.is_active ?? ctx.account.is_active,
    enrollment_no: patch.enrollment_no !== undefined ? (patch.enrollment_no || null) : ctx.account.enrollment_no,
  };

  await connection.begin(async (tx) => {
    await tx`
      UPDATE core.accounts
         SET first_name = ${next.first_name}, last_name = ${next.last_name}, email = ${next.email},
             is_active = ${next.is_active}, enrollment_no = ${next.enrollment_no}, updated_at = now()
       WHERE id = ${ctx.canonicalId}`;

    for (const m of ctx.memberships) {
      if (m.cohort_status !== 'running') continue;
      const schema = m.schema.replace(/"/g, '""');
      await tx.unsafe(
        `UPDATE "${schema}".users SET first_name = $2, last_name = $3, email = $4, is_active = $5, updated_at = now() WHERE id = $1`,
        [m.local_user_id, next.first_name, next.last_name, next.email, next.is_active]);
      if (patch.enrollment_no !== undefined) {
        await tx.unsafe(`UPDATE "${schema}".students SET enrollment_no = $2 WHERE id = $1`, [m.local_user_id, next.enrollment_no]);
      }
    }
  });
  invalidateAccountCache();
}

/** The one place a password changes: core.accounts only. */
export async function setPassword(canonicalId, passwordHash) {
  const rows = await connection`
    UPDATE core.accounts SET password_hash = ${passwordHash}, updated_at = now()
     WHERE id = ${canonicalId} AND merged_into IS NULL RETURNING id`;
  if (!rows.length) throw Object.assign(new Error('Account not found'), { status: 404 });
  invalidateAccountCache();
}

/** Look up an account by email (canonical only). */
export async function getAccountByEmail(email) {
  const [row] = await connection`
    SELECT id, merged_into, email, password_hash, role, first_name, last_name, enrollment_no, is_active
      FROM core.accounts WHERE lower(email) = ${String(email).trim().toLowerCase()} AND merged_into IS NULL`;
  return row || null;
}

/** Create a canonical account (random-password students, admins, faculty). Runs on `tx` when given. */
export async function createAccount(tx, a) {
  const q = tx || connection;
  const [row] = await q`
    INSERT INTO core.accounts (email, password_hash, role, first_name, last_name, enrollment_no, is_active, id)
    VALUES (${a.email.trim().toLowerCase()}, ${a.password_hash}, ${a.role}, ${a.first_name ?? null}, ${a.last_name ?? null},
            ${a.enrollment_no ?? null}, ${a.is_active ?? true}, ${a.id ?? randomUUID()})
    RETURNING id, email, role, first_name, last_name, enrollment_no, is_active`;
  invalidateAccountCache();
  return row;
}
