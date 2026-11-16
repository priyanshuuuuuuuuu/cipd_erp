// Delete only unsent queued/retry messages from the explicitly named test DB.
import postgres from 'postgres';
import { config } from '../src/config.mjs';

const url = new URL(config.databaseUrl);
if (url.hostname !== '192.168.3.190' || url.pathname !== '/cipd_test' || !config.sandbox) {
  throw new Error('Refusing: expected the cipd_test database on the college server in sandbox mode.');
}
const sql = postgres(config.databaseUrl, { max: 1, prepare: false });
const quote = (name) => '"' + name.replace(/"/g, '""') + '"';
try {
  await sql.begin(async (tx) => {
    const schemas = await tx`SELECT table_schema FROM information_schema.tables
      WHERE table_name = 'notification_stream' AND table_type = 'BASE TABLE'
      AND table_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY table_schema`;
    for (const { table_schema } of schemas) {
      await tx.unsafe(`LOCK TABLE ${quote(table_schema)}.notification_stream IN SHARE ROW EXCLUSIVE MODE`);
    }
    for (const { table_schema } of schemas) {
      const [row] = await tx.unsafe(`SELECT count(*)::int AS n FROM ${quote(table_schema)}.notification_stream WHERE status = 'processing' AND (locked_at IS NULL OR locked_at > now() - interval '24 hours')`);
      if (row.n) throw new Error(`Refusing: ${table_schema} has ${row.n} processing messages. Stop workers and retry after they finish.`);
    }
    for (const { table_schema } of schemas) {
      const rows = await tx.unsafe(`DELETE FROM ${quote(table_schema)}.notification_stream WHERE status IN ('queued', 'retry') OR (status = 'processing' AND locked_at <= now() - interval '24 hours') RETURNING id`);
      console.log(`${table_schema}: removed ${rows.length} queued, retrying or stale processing messages`);
    }
  });
} finally {
  await sql.end();
}
