// Read-only queue diagnostics; never claims jobs or sends email.
import { config } from '../src/config.mjs';
import { _sql as sql, _qid as qid, listCohorts, closeStream } from '../src/stream.mjs';

try {
  const target = new URL(config.databaseUrl);
  console.log(`Database: ${target.hostname}:${target.port || '5432'}${target.pathname}`);
  console.log(`Sandbox: ${config.sandbox}; allowlisted recipients: ${config.sandboxRecipients.size}`);
  const cohorts = await listCohorts();
  console.log('Running cohort schemas:', cohorts.join(', ') || '(none)');
  for (const schema of cohorts) {
    const rows = await sql.unsafe(`SELECT status, event_type,
      count(*)::int AS total,
      count(*) FILTER (WHERE available_at <= now())::int AS due,
      count(*) FILTER (WHERE payload->>'sandbox' = 'true')::int AS sandbox_marked,
      count(*) FILTER (WHERE lower(recipient_email) = ANY($1::text[]))::int AS allowlisted,
      count(*) FILTER (WHERE available_at <= now() AND payload->>'sandbox' = 'true'
        AND lower(recipient_email) = ANY($1::text[]))::int AS eligible_sandbox
      FROM ${qid(schema)}.notification_stream
      WHERE status IN ('queued', 'retry', 'failed', 'processing')
      GROUP BY status, event_type ORDER BY status, event_type`, [[...config.sandboxRecipients]]);
    console.log(schema, JSON.stringify(rows));
    const locks = await sql.unsafe(`SELECT locked_by, min(locked_at) AS oldest, max(locked_at) AS newest, count(*)::int AS count
      FROM ${qid(schema)}.notification_stream WHERE status = 'processing' GROUP BY locked_by`);
    if (locks.length) console.log('Processing locks:', JSON.stringify(locks));
    const errors = await sql.unsafe(`SELECT event_type, status, attempts, last_error
      FROM ${qid(schema)}.notification_stream
      WHERE last_error IS NOT NULL ORDER BY updated_at DESC LIMIT 5`);
    console.log('Recent errors:', JSON.stringify(errors));
  }
} catch (error) {
  console.error('Queue diagnostic failed:', error.message);
  process.exitCode = 1;
} finally {
  await closeStream();
}
