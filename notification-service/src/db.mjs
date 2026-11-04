import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { pgTable, uuid, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { config } from './config.mjs';

// Base connection pool for registry and utility queries
export const mainConn = postgres(config.databaseUrl, {
  prepare: false,
  max: 3,
});

/**
 * Definition of the notification_stream table for Drizzle ORM.
 */
export const notificationStream = pgTable('notification_stream', {
  id: uuid().default(sql`gen_random_uuid()`).primaryKey().notNull(),
  dedupeKey: text('dedupe_key').notNull(),
  eventType: text('event_type').notNull(),
  channel: text().notNull(),
  recipientId: uuid('recipient_id'),
  recipientEmail: text('recipient_email').notNull(),
  recipientName: text('recipient_name'),
  payload: jsonb().default({}).notNull(),
  status: text().default('queued').notNull(),
  attempts: integer().default(0).notNull(),
  availableAt: timestamp('available_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  lockedAt: timestamp('locked_at', { withTimezone: true, mode: 'string' }),
  lockedBy: text('locked_by'),
  sentAt: timestamp('sent_at', { withTimezone: true, mode: 'string' }),
  providerMessageId: text('provider_message_id'),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  sessionId: uuid('session_id'),
});

const _dbs = new Map();

/**
 * Returns a cached Drizzle instance configured for the specified schema.
 * @param {string} schemaName
 */
export function getSchemaDb(schemaName = 'public') {
  const key = schemaName || 'public';
  if (_dbs.has(key)) return _dbs.get(key);

  const client = postgres(config.databaseUrl, {
    prepare: false,
    max: 3,
    connection: { search_path: `${key}, public` },
  });
  const db = drizzle(client);
  const entry = { db, client };
  _dbs.set(key, entry);
  return entry;
}

/**
 * Reads the currently active cohort schema name from public.cohorts.
 */
export async function getActiveCohortSchema() {
  try {
    const rows = await mainConn`
      SELECT schema_name FROM public.cohorts WHERE is_active = true LIMIT 1
    `;
    if (rows && rows.length > 0 && rows[0].schema_name) {
      return rows[0].schema_name;
    }
  } catch (err) {
    console.warn('[notification-service/db] Could not get active cohort:', err.message);
  }
  return config.defaultSchema || 'junedecember2026';
}

/**
 * Reads all registered cohort schema names from public.cohorts.
 */
export async function getAllCohortSchemas() {
  try {
    const rows = await mainConn`
      SELECT schema_name FROM public.cohorts ORDER BY created_at ASC
    `;
    if (rows && rows.length > 0) {
      return rows.map((r) => r.schema_name).filter(Boolean);
    }
  } catch (err) {
    console.warn('[notification-service/db] Could not get cohorts:', err.message);
  }
  return [config.defaultSchema || 'junedecember2026'];
}
