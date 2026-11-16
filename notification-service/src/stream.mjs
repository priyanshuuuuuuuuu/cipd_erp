import postgres from 'postgres';
import { config } from './config.mjs';
import { sendFeedbackAvailableEmail, sendPasswordResetEmail, sendStudentWelcomeEmail, sendAttendanceSummaryEmail, sendFacultyWelcomeEmail, sendGeneralNotificationEmail, sendWeeklyScheduleEmail, sendCourseMessageEmail } from '../../client-next/lib/emailer.js';

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
           AND ($2::boolean = false OR (lower(recipient_email) = ANY($3::text[]) AND payload->>'sandbox' = 'true') OR ($4::boolean AND payload->>'testCohort' = 'true'))
         ORDER BY created_at
         LIMIT $1
         FOR UPDATE SKIP LOCKED)
      RETURNING n.*`,
    [limit, sandboxOnly, [...config.sandboxRecipients], config.unrestrictedTestCohort && schema === 'test_1']
  );
}

async function sendJob(job, schema) {
  if (!['feedback_available', 'password_reset', 'student_welcome', 'attendance_summary', 'faculty_welcome', 'general_notification', 'class_reminder', 'weekly_schedule'].includes(job.event_type) || job.channel !== 'email') {
    throw new Error('Unsupported event ' + job.event_type + ' over ' + job.channel);
  }

  if (config.sandbox && !(config.unrestrictedTestCohort && schema === 'test_1' && job.payload?.testCohort === true) && !config.sandboxRecipients.has(job.recipient_email.toLowerCase())) {
    throw new Error('Sandbox blocked non-test recipient: ' + job.recipient_email);
  }

  // Faculty course messages carry senderName/courseName and use the course-message template.
  if (job.event_type === 'general_notification' && (job.payload.courseName || job.payload.senderName)) {
    return sendCourseMessageEmail({
      to: job.recipient_email,
      firstName: job.recipient_name || 'there',
      title: job.payload.title || 'Notification',
      message: job.payload.message || '',
      senderName: job.payload.senderName,
      courseName: job.payload.courseName,
    });
  }
  if (job.event_type === 'general_notification' || job.event_type === 'class_reminder') {
    return sendGeneralNotificationEmail(job.recipient_email, job.recipient_name || 'Student', job.payload.title, job.payload.message, job.payload.type);
  }
  if (job.event_type === 'weekly_schedule') {
    return sendWeeklyScheduleEmail(job.recipient_email, job.recipient_name || 'Student', job.payload.sessions || []);
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
  if (job.event_type === 'faculty_welcome') {
    return sendFacultyWelcomeEmail({ to: job.recipient_email, firstName: job.recipient_name || 'there' });
  }
  if (job.event_type === 'password_reset' || job.event_type === 'student_welcome') {
    // Older self-service resets encoded the JSON object as a JSON string.
    const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
    if (!payload?.resetToken && !payload?.resetUrl) {
      throw Object.assign(new Error('Missing password reset link; request a new email.'), { terminal: true });
    }
    if (payload.resetToken) {
      try {
        const claims = JSON.parse(Buffer.from(payload.resetToken.split('.')[1], 'base64url').toString('utf8'));
        if (!Number.isFinite(claims.exp) || claims.exp <= Date.now() / 1000) {
          throw new Error('Password reset link has expired; request a new email.');
        }
      } catch (error) {
        throw Object.assign(new Error(error.message === 'Password reset link has expired; request a new email.' ? error.message : 'Invalid password reset token; request a new email.'), { terminal: true });
      }
    }
    let resetUrl = payload.resetUrl;
    if (!resetUrl) {
      if (!config.appUrl) throw new Error('APP_URL is not set; cannot build the password reset link');
      resetUrl = config.appUrl + '/reset-password?token=' + payload.resetToken;
    }
    return (job.event_type === 'student_welcome' || payload.studentWelcome ? sendStudentWelcomeEmail : sendPasswordResetEmail)({
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
      const info = await sendJob(job, schema);
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
      const terminal = error.terminal || job.attempts >= maxAttempts;
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
  const schemas = await resolveSchemas(schema);
  if (!schema) {
    const locations = await Promise.all(schemas.map(async (name) => {
      const [message] = await sql.unsafe(`SELECT id FROM ${qid(name)}.notification_stream WHERE id = $1`, [id]);
      return message ? name : null;
    }));
    const matches = locations.filter(Boolean);
    if (matches.length > 1) throw new Error('Message ID exists in multiple cohorts. Specify the cohort in the retry URL.');
    [schema] = matches;
    if (!schema) throw new Error('Message is not retryable.');
  }
  const rows = await sql.unsafe(
    `UPDATE ${qid(schema)}.notification_stream
        SET status = 'queued', attempts = 0, available_at = now(), last_error = NULL,
            locked_at = NULL, locked_by = NULL, updated_at = now()
      WHERE id = $1 AND status IN ('failed','retry')
      RETURNING id, status`,
    [id]
  );
  if (!rows.length) throw new Error('Message is not retryable.');
  return { schema, ...rows[0] };
}

export async function closeStream() {
  await sql.end({ timeout: 5 });
}

export { sql as _sql, qid as _qid };
