/**
 * Wi-Fi snapshot access (SERVER ONLY).
 *
 * The Wi-Fi attendance scanner runs on a separate network that cannot reach the
 * college VM, so it writes `public.wifi_snapshots` to a Supabase cloud project.
 * This is the ONLY module allowed to import `@supabase/supabase-js`. Everything
 * else in the ERP lives on the VM PostgreSQL.
 *
 * Every function throws `WifiSourceUnavailableError` when Supabase cannot be
 * reached or returns an error. None of them returns an empty result on failure:
 * callers must be able to tell "nobody attended" from "we could not look".
 */
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

if (typeof window !== 'undefined') {
  throw new Error('lib/wifi-snapshots.js must only be imported on the server');
}

const PAGE = 1000; // PostgREST default max-rows

export class WifiSourceUnavailableError extends Error {
  constructor(message, cause) {
    super(message || 'Wi-Fi data source unavailable');
    this.name = 'WifiSourceUnavailableError';
    this.code = 'WIFI_SOURCE_UNAVAILABLE';
    if (cause) this.cause = cause;
  }
}

export function isWifiSourceUnavailable(err) {
  return err instanceof WifiSourceUnavailableError || err?.code === 'WIFI_SOURCE_UNAVAILABLE';
}

/**
 * For route catch blocks: returns a 503 Response if `err` is a Wi-Fi source
 * outage, otherwise null (caller continues with its normal 500 handling).
 */
export function wifiErrorResponse(err) {
  if (!isWifiSourceUnavailable(err)) return null;
  console.error('[wifi] source unavailable:', err.message);
  return NextResponse.json({ error: 'Wi-Fi data source unavailable' }, { status: 503 });
}

let _client = null;

function getClient() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) {
    throw new WifiSourceUnavailableError('Wi-Fi source is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
  }
  _client = createClient(url, key, {
    db: { schema: 'public' },
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (u, o) => fetch(u, { ...o, cache: 'no-store' }) },
  });
  return _client;
}

function table() {
  return getClient().schema('public').from('wifi_snapshots');
}

function unwrap({ data, error }, what) {
  if (error) {
    throw new WifiSourceUnavailableError(`Wi-Fi source error (${what}): ${error.message || error.code || 'unknown'}`, error);
  }
  return data;
}

async function guarded(what, fn) {
  try {
    return await fn();
  } catch (err) {
    if (isWifiSourceUnavailable(err)) throw err;
    // network failures surface as thrown TypeErrors from fetch
    throw new WifiSourceUnavailableError(`Wi-Fi source unreachable (${what}): ${err?.message || err}`, err);
  }
}

/**
 * All snapshots with startISO <= captured_at <= endISO, ascending.
 * Paginated, so long windows are never silently truncated.
 */
export async function getSnapshotsBetween(startISO, endISO, { columns = 'id, iw_dump, captured_at' } = {}) {
  return guarded('between', async () => {
    const out = [];
    for (let offset = 0; ; offset += PAGE) {
      const page = unwrap(
        await table()
          .select(columns)
          .gte('captured_at', startISO)
          .lte('captured_at', endISO)
          .order('captured_at', { ascending: true })
          .range(offset, offset + PAGE - 1),
        'between'
      );
      out.push(...(page || []));
      if (!page || page.length < PAGE) break;
    }
    return out;
  });
}

/** Newest `limit` snapshots, newest first. */
export async function getLatestSnapshots(limit = 1, { columns = 'id, iw_dump, captured_at' } = {}) {
  return guarded('latest', async () =>
    unwrap(
      await table().select(columns).order('captured_at', { ascending: false }).limit(limit),
      'latest'
    ) || []
  );
}

/** `{ captured_at } | null` */
export async function getLatestSnapshot() {
  const rows = await getLatestSnapshots(1, { columns: 'captured_at' });
  return rows[0] || null;
}

export async function countSnapshots() {
  return guarded('count', async () => {
    const { count, error } = await table().select('id', { count: 'exact', head: true });
    if (error) throw new WifiSourceUnavailableError(`Wi-Fi source error (count): ${error.message}`, error);
    return count || 0;
  });
}

export async function countSnapshotsBetween(startISO, endISO) {
  return guarded('count-between', async () => {
    let q = table().select('id', { count: 'exact', head: true });
    if (startISO) q = q.gte('captured_at', startISO);
    if (endISO) q = q.lte('captured_at', endISO);
    const { count, error } = await q;
    if (error) throw new WifiSourceUnavailableError(`Wi-Fi source error (count): ${error.message}`, error);
    return count || 0;
  });
}

/**
 * One page of snapshots, newest first, optionally date-bounded.
 * `offset`/`limit` are row offsets; returns up to `limit` rows.
 */
export async function getSnapshotsPage({ from, to, offset = 0, limit = 100, columns = 'id, captured_at, iw_dump, error' } = {}) {
  return guarded('page', async () => {
    let q = table().select(columns).order('captured_at', { ascending: false });
    if (from) q = q.gte('captured_at', from);
    if (to) q = q.lte('captured_at', to);
    return unwrap(await q.range(offset, offset + limit - 1), 'page') || [];
  });
}
