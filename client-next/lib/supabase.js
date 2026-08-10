import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Lazy-initialized clients — avoids crashing at build time when env vars are not set
let _supabase = null;
let _supabaseAdmin = null;

/**
 * Client-side Supabase client (uses anon key, respects RLS).
 */
export const supabase = new Proxy({}, {
  get(_, prop) {
    if (!_supabase) {
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
      }
      _supabase = createClient(supabaseUrl, supabaseAnonKey, {
        db: { schema: 'july' },
        global: {
          fetch: (url, options) => {
            return fetch(url, { ...options, cache: 'no-store' });
          },
        },
      });
    }
    return _supabase[prop];
  },
});

/**
 * Server-side Supabase client (uses service role key, bypasses RLS).
 * Hardcoded to 'july' schema. For other schemas use getSchemaClient().
 */
export const supabaseAdmin = new Proxy({}, {
  get(_, prop) {
    if (!_supabaseAdmin) {
      if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      }
      _supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        db: { schema: 'july' },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        global: {
          fetch: (url, options) => {
            return fetch(url, { ...options, cache: 'no-store' });
          },
        },
      });
    }
    return _supabaseAdmin[prop];
  },
});

/**
 * Per-schema client cache — one service-role client per schema.
 * Used by admin routes that need to query non-default schemas.
 */
const _schemaClients = new Map();

/**
 * Returns (and caches) a service-role Supabase client for the given schema.
 * Falls back to 'july' if schema is undefined/null/empty.
 *
 * @param {string} schema - Supabase schema name (e.g. 'july', 'public')
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function getSchemaClient(schema = 'july') {
  const key = schema || 'july';
  if (!_schemaClients.has(key)) {
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }
    _schemaClients.set(key, createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: key },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
      },
    }));
  }
  return _schemaClients.get(key);
}

/**
 * Returns the list of allowed cohort schemas from env and their display labels.
 * Reads COHORT_SCHEMAS (comma-separated) and COHORT_LABELS (JSON).
 *
 * @returns {{ schemas: string[], labels: Record<string,string> }}
 */
export function getCohortConfig() {
  const raw = process.env.COHORT_SCHEMAS || 'july';
  const schemas = raw.split(',').map(s => s.trim()).filter(Boolean);

  let labels = {};
  try {
    labels = JSON.parse(process.env.COHORT_LABELS || '{}');
  } catch {
    // If COHORT_LABELS is malformed, fall back to using schema name as label
  }

  // Default label = capitalised schema name
  const resolved = {};
  for (const s of schemas) {
    resolved[s] = labels[s] || s.charAt(0).toUpperCase() + s.slice(1);
  }

  return { schemas, labels: resolved };
}

