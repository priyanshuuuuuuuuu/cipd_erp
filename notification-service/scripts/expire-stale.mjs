// One-off: mark old undelivered notifications as failed('expired_before_vm_cutover') so they are
// never sent after the service moves to the VM. Run with --dry-run first. The OWNER decides
// whether to run it for real.
//
//   node scripts/expire-stale.mjs --schema junedecember2026 --before 2026-10-25 --dry-run
//   node scripts/expire-stale.mjs --schema junedecember2026 --before 2026-10-25
import postgres from 'postgres';
import dotenv from 'dotenv';
import { resolve } from 'node:path';

dotenv.config({ path: resolve(process.cwd(), '.env') });
dotenv.config({ path: resolve(process.cwd(), '../client-next/.env'), override: false });
dotenv.config({ path: resolve(process.cwd(), '../client-next/.env.local'), override: false });

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };

const schema = opt('schema');
const before = opt('before');
const dry = flag('dry-run');
if (!schema || !/^[a-z][a-z0-9_]{2,40}$/.test(schema) || !before || Number.isNaN(Date.parse(before))) {
  console.error('Usage: node scripts/expire-stale.mjs --schema <schema> --before <YYYY-MM-DD> [--dry-run]');
  process.exit(2);
}
if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is required'); process.exit(2); }

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
const t = `"${schema}".notification_stream`;
try {
  const rows = await sql.unsafe(
    `SELECT event_type, status, count(*)::int AS n, min(created_at) AS first, max(created_at) AS last
       FROM ${t} WHERE status IN ('queued','retry') AND created_at < $1::date
      GROUP BY 1, 2 ORDER BY 1, 2`, [before]);
  console.table(rows);
  if (dry) {
    console.log('dry-run: nothing changed');
  } else {
    const res = await sql.unsafe(
      `UPDATE ${t} SET status = 'failed', last_error = 'expired_before_vm_cutover',
              locked_at = NULL, locked_by = NULL, updated_at = now()
        WHERE status IN ('queued','retry') AND created_at < $1::date`, [before]);
    console.log(`expired ${res.count} message(s)`);
  }
} finally {
  await sql.end();
}
