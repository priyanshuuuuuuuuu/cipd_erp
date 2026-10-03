import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../drizzle/schema';
import * as relations from '../drizzle/relations';
import config, { DEFAULT_SCHEMA } from '../config';

// Disable prefetch as it is not supported for "Transaction" pool mode
export const connection = postgres(process.env.DATABASE_URL, { 
  prepare: false,
  connection: {
    search_path: `${DEFAULT_SCHEMA}, public`
  }
});

export const db = drizzle(connection, { schema: { ...schema, ...relations } });

// Cache for schema-specific drizzle instances
const _schemaDbs = new Map();

/**
 * Returns (and caches) a Drizzle instance configured for the given schema.
 * Uses postgres options to set search_path on the connection.
 * @param {string} schemaName 
 */
export function getSchemaDb(schemaName = DEFAULT_SCHEMA) {
  const key = schemaName || DEFAULT_SCHEMA;
  if (!_schemaDbs.has(key)) {
    const conn = postgres(process.env.DATABASE_URL, { 
      prepare: false,
      connection: {
        search_path: `${key}, public`
      }
    });
    _schemaDbs.set(key, drizzle(conn, { schema: { ...schema, ...relations } }));
  }
  return _schemaDbs.get(key);
}

/**
 * Returns the list of allowed cohort schemas from env and their display labels.
 * Reads COHORT_SCHEMAS (comma-separated) and COHORT_LABELS (JSON).
 *
 * @returns {{ schemas: string[], labels: Record<string,string> }}
 */
export function getCohortConfig() {
  const raw = process.env.COHORT_SCHEMAS || DEFAULT_SCHEMA;
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
