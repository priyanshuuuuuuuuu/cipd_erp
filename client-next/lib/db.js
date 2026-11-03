import { AsyncLocalStorage } from 'node:async_hooks';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../drizzle/schema';
import * as relations from '../drizzle/relations';
import config, { DEFAULT_SCHEMA } from '../config';

// ── Global singleton helpers ──────────────────────────────────────────────────
// In Next.js dev mode the module is re-evaluated on every hot reload, which
// creates fresh postgres() pools each time while orphaned pools stay open.
// Storing everything on globalThis means a single set of pools for the entire
// Node process lifetime.
const g = globalThis;

// ── Main connection (used for cohort registry queries) ────────────────────────
if (!g._pgMainConn) {
  g._pgMainConn = postgres(process.env.DATABASE_URL, {
    prepare: false,
    max: 3,
    connection: { search_path: 'core' },
  });
}
export const connection = g._pgMainConn;

// ── Request-scoped cohort schema ──────────────────────────────────────────────
// withAuth() runs each handler inside runWithSchema(), so the exported `db`
// below transparently targets the cohort selected for that request.
const _schemaStore = new AsyncLocalStorage();

/** Run `fn` with `schemaName` as the current cohort schema. */
export function runWithSchema(schemaName, fn) {
  return _schemaStore.run({ schema: schemaName }, fn);
}

/** Cohort schema selected for the current request (undefined outside a request). */
export function getRequestSchema() {
  return _schemaStore.getStore()?.schema;
}

/**
 * Drizzle instance for the current request's cohort. Outside a request context
 * (cron, scripts) it falls back to DEFAULT_SCHEMA; use getSchemaDb(await getActiveSchema())
 * where the active cohort is required.
 */
export const db = new Proxy({}, {
  get(_t, prop) {
    const target = getSchemaDb(getRequestSchema() || DEFAULT_SCHEMA);
    const value = target[prop];
    return typeof value === 'function' ? value.bind(target) : value;
  },
});

// ── Per-schema drizzle instances ──────────────────────────────────────────────
// Stored on globalThis so hot-reload doesn't orphan old pools. There is no
// eviction: each pool closes its own idle connections (idle_timeout), so an
// unused cohort costs nothing, and an in-flight request can never have its pool
// ended underneath it.
if (!g._pgSchemaDbs) g._pgSchemaDbs = new Map(); // key -> { db, conn }
const _schemaDbs = g._pgSchemaDbs;

/**
 * Returns (and caches) a Drizzle instance configured for the given schema.
 * Uses postgres options to set search_path on the connection.
 * @param {string} schemaName
 */
export function getSchemaDb(schemaName = DEFAULT_SCHEMA) {
  const key = schemaName || DEFAULT_SCHEMA;
  if (_schemaDbs.has(key)) return _schemaDbs.get(key).db;

  const conn = postgres(process.env.DATABASE_URL, {
    prepare: false,
    max: 3,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
    // The cohort schema first, then `core` for shared types. `public` is NOT on the path for
    // non-public cohorts, so a missing table can never silently resolve to another cohort's data.
    connection: { search_path: `"${key}", core` },
  });
  const entry = { conn, db: drizzle(conn, { schema: { ...schema, ...relations } }) };
  _schemaDbs.set(key, entry);
  return entry.db;
}

// ── Cohort registry (core.cohorts) ────────────────────────────────────────────
const COHORT_CACHE_TTL_MS = 30_000;
// Also persist the cache across hot reloads so we don't spam the DB
if (!g._pgCohortCache) g._pgCohortCache = null;

// Other in-process caches (accounts, memberships) register here so one call clears them all.
if (!g._pgInvalidators) g._pgInvalidators = new Set();
export function onCacheInvalidate(fn) {
  g._pgInvalidators.add(fn);
}

function clearLocalCaches() {
  g._pgCohortCache = null;
  for (const fn of g._pgInvalidators) { try { fn(); } catch { /* ignore */ } }
}

// With several app processes (PM2 cluster) a change made in one must reach the others:
// invalidate locally, then NOTIFY; every process LISTENs and clears its own caches.
// Started lazily on the first registry read, never at import time (so `next build` opens no connection).
function ensureListening() {
  if (g._pgListening) return;
  g._pgListening = true;
  connection.listen('cohorts_changed', () => clearLocalCaches()).catch((err) => {
    console.error('cohorts_changed LISTEN failed (cache sync across processes disabled):', err.message);
    g._pgListening = false;
  });
}

export function invalidateCohortCache() {
  clearLocalCaches();
  connection.notify('cohorts_changed', String(process.pid)).catch(() => {});
}

function envCohortFallback() {
  const raw = process.env.COHORT_SCHEMAS || DEFAULT_SCHEMA;
  const schemas = raw.split(',').map(s => s.trim()).filter(Boolean);
  let labels = {};
  try {
    labels = JSON.parse(process.env.COHORT_LABELS || '{}');
  } catch {
    // malformed COHORT_LABELS: fall back to capitalised schema names
  }
  const resolved = {};
  for (const s of schemas) {
    resolved[s] = labels[s] || s.charAt(0).toUpperCase() + s.slice(1);
  }
  const active = schemas.includes(DEFAULT_SCHEMA) ? DEFAULT_SCHEMA : schemas[0];
  const cohorts = schemas.map((schema, i) => ({
    id: i + 1, schema, schema_name: schema, label: resolved[schema], program: null, starts_on: null, ends_on: null,
    status: 'running', is_default: schema === active, is_legacy: false,
  }));
  return { cohorts, all: cohorts, schemas, labels: resolved, active };
}

function buildConfig(rows) {
  const all = rows.map(r => ({
    id: r.id,
    schema: r.schema_name,
    schema_name: r.schema_name, // same value; services use the registry column name
    label: r.label,
    program: r.program,
    starts_on: r.starts_on,
    ends_on: r.ends_on,
    status: r.status,
    is_default: r.is_default,
    is_legacy: r.is_legacy,
    schema_version: r.schema_version,
    last_error: r.last_error,
  }));
  // `cohorts` = what users may select (running or archived). provisioning/failed/deleting are admin-only via `all`.
  const cohorts = all.filter(c => c.status === 'running' || c.status === 'archived');
  const labels = {};
  for (const c of cohorts) labels[c.schema] = c.label;
  const def = cohorts.find(c => c.is_default && c.status === 'running')
    || cohorts.filter(c => c.status === 'running').slice(-1)[0]
    || cohorts[cohorts.length - 1];
  return { cohorts, all, schemas: cohorts.map(c => c.schema), labels, active: def?.schema };
}

/**
 * Returns the cohort registry (cached ~30s).
 *   { cohorts, all, schemas, labels, active }
 * `active` is the default cohort (kept under this name for existing callers).
 * Falls back to COHORT_SCHEMAS / DEFAULT_SCHEMA only when core.cohorts does not exist yet.
 */
export async function getCohortConfig() {
  ensureListening();
  if (g._pgCohortCache && Date.now() - g._pgCohortCache.at < COHORT_CACHE_TTL_MS) {
    return g._pgCohortCache.value;
  }

  let value;
  try {
    const rows = await connection`
      SELECT id, schema_name, label, program, starts_on, ends_on, status, is_default, is_legacy,
             schema_version, last_error
      FROM core.cohorts
      ORDER BY id ASC`;
    value = rows.length ? buildConfig(rows) : envCohortFallback();
  } catch (err) {
    if (err?.code === '42P01') {
      // Registry table does not exist yet (fresh bootstrap): use env fallback.
      console.error('getCohortConfig: core.cohorts missing, using env fallback');
      value = envCohortFallback();
    } else if (g._pgCohortCache) {
      // Transient DB error: keep serving the last known registry rather than
      // silently switching to a hard-coded cohort list.
      console.error('getCohortConfig: registry unavailable, serving stale cache:', err.message);
      g._pgCohortCache.at = Date.now() - COHORT_CACHE_TTL_MS + 5_000; // retry in ~5s
      return g._pgCohortCache.value;
    } else {
      throw err;
    }
  }

  g._pgCohortCache = { at: Date.now(), value };
  return value;
}

/** The default cohort schema (used by students, cron and notifications). */
export async function getActiveSchema() {
  const { active } = await getCohortConfig();
  return active || DEFAULT_SCHEMA;
}

/** Schemas of cohorts with status 'running' (what background jobs iterate). */
export async function getRunningSchemas() {
  const { cohorts } = await getCohortConfig();
  return cohorts.filter(c => c.status === 'running').map(c => c.schema);
}

/** Validates a cohort name before it is ever used in DDL. */
export const COHORT_NAME_RE = /^[a-z][a-z0-9_]{2,40}$/;
