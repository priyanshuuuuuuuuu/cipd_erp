import postgres from 'postgres';
import { config } from './config.mjs';
import { sendFeedbackAvailableEmail, sendPasswordResetEmail, sendAttendanceSummaryEmail } from '../../client-next/lib/emailer.js';

// Notifications are read from the college VM PostgreSQL (no Supabase).
// One table per cohort: "<schema>".notification_stream. All running cohorts are served.
const sql = postgres(config.databaseUrl, { max: 3, prepare: false, idle_timeout: 20, max_lifetime: 60 * 30 });

const maxAttempts = 6;
const STALE_LOCK_MINUTES = 15;
const SCHEMA_RE = /^[a-z][a-z0-9_]{2,40}$/;
const qid = (id) => '"' + String(id).replace(/"/g, '""') + '"';

function retryDelayMs(attempt) {
  return Math.min(30 * 60 * 1000, 60 * 1000 * (2 ** Math.max(0, attempt - 1)));
}

/**
 * Cohort schemas to serve.
 *  - After the core migration: core.cohorts WHERE status = 'running'
 *  - Before it: the single active row of the legacy public.cohorts registry
 */
export async function listCohorts() {
  const [{ has_core }] = await sql`SELECT to_regclass('core.cohorts') IS NOT NULL AS has_core`;
  const rows = has_core
    ? await sql`SELECT schema_name FROM core.cohorts WHERE status = 'running' ORDER BY id`
    : await sql`SELECT schema_name FROM public.cohorts WHERE is_active ORDER BY created_at`;
  return rows.map((r) => r.schema_name).filter((s) => SCHEMA_RE.test(s));
}

async function resolveSchemas(schema) {
  const all = await listCohorts();
  if (!schema) return all;
  if (!all.includes(schema)) throw new Error('Unknown or non-running cohort: ' + schema);
  return [schema];
}

export async function getQueueCounts(schema) {
  const out = {};
  for (const s of await resolveSchemas(schema)) {
    const counts = { queued: 0, processing: 0, retry: 0, sent: 0, failed: 0 };
    const rows = await sql.unsafe(`SELECT status, count(*)::int AS n FROM ${qid(s)}.notification_stream GROUP BY status`);
    for (const r of rows) counts[r.status] = r.n;
    out[s] = counts;
  }
  return out;
}

export async function listMessages(limit = 50, { schema, status } = {}) {
  const messages = [];
  for (const s of await resolveSchemas(schema)) {
    const rows = await sql.unsafe(
      `SELECT id, event_type, recipient_email, status, attempts, available_at, sent_at,
              provider_message_id, last_error, created_at
         FROM ${qid(s)}.notification_stream
        WHERE ($2::text IS NULL OR status = $2)
        ORDER BY created_at DESC LIMIT $1`,
      [limit, status || null]
    );
    for (const r of rows) messages.push({ ...r, schema: s });
  }
  messages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return messages.slice(0, limit);
}

async function recoverStaleLocks(schema) {
  await sql.unsafe(
    `UPDATE ${qid(schema)}.notification_stream
        SET status = 'retry', locked_at = NULL, locked_by = NULL, updated_at = now()
      WHERE status = 'processing' AND locked_at < now() - interval '${STALE_LOCK_MINUTES} minutes'`
  );
}

/**
 * Atomically claim up to `limit` due messages (safe with several workers).
 * In sandbox mode only messages addressed to sandbox recipients are claimed,
 * so real recipients' queued mail is left untouched rather than burned as failures.
 */
async function claimAvailableMessages(schema, limit) {
  const sandboxOnly = config.sandbox;
  return sql.unsafe(
    `UPDATE ${qid(schema)}.notification_stream n
        SET status = 'processing', attempts = n.attempts + 1,
            locked_at = now(), locked_by = 'notification-service', updated_at = now()
      WHERE n.id IN (
        SELECT id FROM ${qid(schema)}.notification_stream
         WHERE status IN ('queued','retry') AND available_at <= now()
           AND ($2::boolean = false OR lower(recipient_email) = ANY($3::text[]))
         ORDER BY created_at
         LIMIT $1
         FOR UPDATE SKIP LOCKED)
      RETURNING n.*`,
    [limit, sandboxOnly, [...config.sandboxRecipients]]
  );
}

async function sendJob(job) {
  if (!['feedback_available', 'password_reset', 'attendance_summary'].includes(job.event_type) || job.channel !== 'email') {
    throw new Error('Unsupported event ' + job.event_type + ' over ' + job.channel);
  }

  if (config.sandbox && !config.sandboxRecipients.has(job.recipient_email.toLowerCase())) {
    throw new Error('Sandbox blocked non-test recipient: ' + job.recipient_email);
  }

  if (job.event_type === 'feedback_available') {
    return sendFeedbackAvailableEmail(
      job.recipient_email,
      job.recipient_name || 'Student',
      job.payload.session,
      job.payload.deadline,
      { messageId: '<cipd-feedback-' + job.id + '@iiitd.ac.in>' }
    );
  }
  if (job.event_type === 'password_reset') {
    let resetUrl = job.payload.resetUrl;
    if (!resetUrl) {
      if (!config.appUrl) throw new Error('APP_URL is not set; cannot build the password reset link');
      resetUrl = config.appUrl + '/reset-password?token=' + job.payload.resetToken;
    }
    return sendPasswordResetEmail({
      to: job.recipient_email,
      firstName: job.recipient_name || 'Student',
      resetUrl,
    });
  }
  return sendAttendanceSummaryEmail(
    job.recipient_email,
    job.recipient_name || 'Student',
    job.payload.session,
    job.payload.firstSeenAt
  );
}

async function drainSchema(schema, limit, result) {
  await recoverStaleLocks(schema);
  const jobs = await claimAvailableMessages(schema, limit);
  const bucket = (result.bySchema[schema] = { claimed: jobs.length, sent: 0, retried: 0, failed: 0 });
  result.claimed += jobs.length;

  for (const job of jobs) {
    try {
      const info = await sendJob(job);
      await sql.unsafe(
        `UPDATE ${qid(schema)}.notification_stream
            SET status = 'sent', sent_at = now(), provider_message_id = $2, last_error = NULL,
                locked_at = NULL, locked_by = NULL, updated_at = now()
          WHERE id = $1`,
        [job.id, info?.messageId || null]
      );
      bucket.sent += 1;
      result.sent += 1;
    } catch (error) {
      const terminal = job.attempts >= maxAttempts;
      try {
        await sql.unsafe(
          `UPDATE ${qid(schema)}.notification_stream
              SET status = $2,
                  available_at = CASE WHEN $2 = 'failed' THEN available_at ELSE now() + ($3 || ' milliseconds')::interval END,
                  last_error = $4, locked_at = NULL, locked_by = NULL, updated_at = now()
            WHERE id = $1`,
          [job.id, terminal ? 'failed' : 'retry', String(retryDelayMs(job.attempts)), error.message]
        );
        if (terminal) { bucket.failed += 1; result.failed += 1; } else { bucket.retried += 1; result.retried += 1; }
      } catch (updateError) {
        result.errors.push(schema + '/' + job.id + ': ' + updateError.message);
      }
      result.errors.push(schema + '/' + job.id + ': ' + error.message);
    }
  }
}

export async function drainStream(limit = 20) {
  const result = { claimed: 0, sent: 0, retried: 0, failed: 0, errors: [], bySchema: {} };
  for (const schema of await listCohorts()) {
    try {
      await drainSchema(schema, limit, result);
    } catch (error) {
      result.errors.push(schema + ': ' + error.message);
    }
  }
  return result;
}

export async function retryMessage(schema, id) {
  const [s] = await resolveSchemas(schema);
  const rows = await sql.unsafe(
    `UPDATE ${qid(s)}.notification_stream
        SET status = 'queued', attempts = 0, available_at = now(), last_error = NULL,
            locked_at = NULL, locked_by = NULL, updated_at = now()
      WHERE id = $1 AND status IN ('failed','retry')
      RETURNING id, status`,
    [id]
  );
  if (!rows.length) throw new Error('Message is not retryable.');
  return { schema: s, ...rows[0] };
}

export async function closeStream() {
  await sql.end({ timeout: 5 });
}

export { sql as _sql, qid as _qid };
