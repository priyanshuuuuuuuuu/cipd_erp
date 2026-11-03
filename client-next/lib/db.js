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
    connection: { search_path: `${DEFAULT_SCHEMA}, public` },
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
    connection: { search_path: `${key}, public` },
  });
  const entry = { conn, db: drizzle(conn, { schema: { ...schema, ...relations } }) };
  _schemaDbs.set(key, entry);
  return entry.db;
}

// ── Cohort registry (public.cohorts) ──────────────────────────────────────────
const COHORT_CACHE_TTL_MS = 30_000;
// Also persist the cache across hot reloads so we don't spam the DB
if (!g._pgCohortCache) g._pgCohortCache = null;

export function invalidateCohortCache() {
  g._pgCohortCache = null;
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
  return { schemas, labels: resolved, active: schemas.includes(DEFAULT_SCHEMA) ? DEFAULT_SCHEMA : schemas[0] };
}

/**
 * Returns the cohorts registered in public.cohorts (cached ~30s).
 * Falls back to COHORT_SCHEMAS / DEFAULT_SCHEMA if the table is missing/empty.
 *
 * @returns {Promise<{ schemas: string[], labels: Record<string,string>, active: string }>}
 */
export async function getCohortConfig() {
  if (g._pgCohortCache && Date.now() - g._pgCohortCache.at < COHORT_CACHE_TTL_MS) {
    return g._pgCohortCache.value;
  }

  let value;
  try {
    const rows = await connection`
      SELECT schema_name, label, is_active
      FROM public.cohorts
      ORDER BY created_at ASC, schema_name ASC`;
    if (!rows.length) {
      value = envCohortFallback();
    } else {
      const labels = {};
      for (const r of rows) labels[r.schema_name] = r.label;
      const activeRow = rows.find(r => r.is_active) || rows[rows.length - 1];
      value = { schemas: rows.map(r => r.schema_name), labels, active: activeRow.schema_name };
    }
  } catch (err) {
    if (err?.code === '42P01') {
      // Registry table does not exist yet (fresh bootstrap): use env fallback.
      console.error('getCohortConfig: registry table missing, using env fallback');
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

/** The currently active cohort schema (used by students, cron and notifications). */
export async function getActiveSchema() {
  const { active } = await getCohortConfig();
  return active || DEFAULT_SCHEMA;
}

/** Validates a cohort name before it is ever used in DDL. */
export const COHORT_NAME_RE = /^[a-z][a-z0-9_]{2,40}$/;
