import postgres from 'postgres';
import { config } from './config.mjs';
import { sendFeedbackAvailableEmail, sendPasswordResetEmail, sendAttendanceSummaryEmail, sendGeneralNotificationEmail, sendWeeklyScheduleEmail } from '../../client-next/lib/emailer.js';

const sql = postgres(config.databaseUrl, { prepare: false, max: 4 });

const maxAttempts = 6;

function retryDelayMs(attempt) {
  return Math.min(30 * 60 * 1000, 60 * 1000 * (2 ** Math.max(0, attempt - 1)));
}

// The app writes to the selected cohort's schema, so drain every schema that has the outbox table.
async function outboxSchemas() {
  const rows = await sql`
    SELECT table_schema FROM information_schema.tables
    WHERE table_name = 'notification_stream'
      AND table_schema NOT IN ('information_schema', 'pg_catalog')`;
  return rows.map((r) => r.table_schema);
}

export async function getQueueCounts() {
  const counts = { queued: 0, processing: 0, retry: 0, sent: 0, failed: 0 };
  for (const schema of await outboxSchemas()) {
    const rows = await sql`SELECT status, count(*)::int AS n FROM ${sql(schema)}.notification_stream GROUP BY status`;
    for (const r of rows) counts[r.status] = (counts[r.status] || 0) + r.n;
  }
  return counts;
}

export async function listMessages(limit = 50) {
  const all = [];
  for (const schema of await outboxSchemas()) {
    const rows = await sql`
      SELECT id, event_type, recipient_email, status, attempts, available_at, sent_at,
             provider_message_id, last_error, created_at
      FROM ${sql(schema)}.notification_stream ORDER BY created_at DESC LIMIT ${limit}`;
    all.push(...rows.map((r) => ({ ...r, schema })));
  }
  return all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, limit);
}

async function claimAvailableMessages(schema, limit) {
  return sql`
    UPDATE ${sql(schema)}.notification_stream
    SET status = 'processing', attempts = attempts + 1, locked_at = now(),
        locked_by = 'notification-service', updated_at = now()
    WHERE id IN (
      SELECT id FROM ${sql(schema)}.notification_stream
      WHERE status IN ('queued', 'retry') AND available_at <= now()
      ORDER BY created_at ASC LIMIT ${limit}
      FOR UPDATE SKIP LOCKED)
    RETURNING *`;
}

export async function drainStream(limit = 20) {
  const result = { claimed: 0, sent: 0, retried: 0, failed: 0, errors: [] };
  const jobs = [];
  for (const schema of await outboxSchemas()) {
    for (const job of await claimAvailableMessages(schema, limit)) jobs.push({ ...job, _schema: schema });
  }
  result.claimed = jobs.length;

  for (const job of jobs) {
    try {
      if (!['feedback_available', 'password_reset', 'attendance_summary', 'general_notification', 'class_reminder', 'weekly_schedule'].includes(job.event_type) || job.channel !== 'email') {
        throw new Error('Unsupported event ' + job.event_type + ' over ' + job.channel);
      }

      if (config.sandbox && !config.sandboxRecipients.has(job.recipient_email.toLowerCase())) {
        throw new Error('Sandbox blocked non-test recipient: ' + job.recipient_email);
      }

      let info;
      if (job.event_type === 'feedback_available') {
        info = await sendFeedbackAvailableEmail(
          job.recipient_email,
          job.recipient_name || 'Student',
          job.payload.session,
          job.payload.deadline,
          { messageId: '<cipd-feedback-' + job.id + '@iiitd.ac.in>' }
        );
      } else if (job.event_type === 'password_reset') {
        info = await sendPasswordResetEmail({
          to: job.recipient_email,
          firstName: job.recipient_name || 'Student',
          resetUrl: job.payload.resetUrl || 'https://cipd-erp-ic24.vercel.app/reset-password?token=' + job.payload.resetToken
        });
      } else if (job.event_type === 'general_notification' || job.event_type === 'class_reminder') {
        info = await sendGeneralNotificationEmail(
          job.recipient_email,
          job.recipient_name || 'Student',
          job.payload.title,
          job.payload.message,
          job.payload.type || job.event_type
        );
      } else if (job.event_type === 'weekly_schedule') {
        info = await sendWeeklyScheduleEmail(
          job.recipient_email,
          job.recipient_name || 'Student',
          job.payload.sessions
        );
      } else if (job.event_type === 'attendance_summary') {
        info = await sendAttendanceSummaryEmail(
          job.recipient_email,
          job.recipient_name || 'Student',
          job.payload.session,
          job.payload.firstSeenAt
        );
      }

      if (info?.rejected?.length) {
        throw new Error('SMTP rejected recipient: ' + info.rejected.join(', '));
      }
      console.log('[notification-service] SENT ' + job.event_type + ' -> ' + job.recipient_email
        + ' (' + (info?.messageId || 'no id') + ') smtp: ' + (info?.response || 'n/a'));

      await sql`
        UPDATE ${sql(job._schema)}.notification_stream
        SET status = 'sent', sent_at = now(), provider_message_id = ${info?.messageId || null},
            last_error = null, locked_at = null, locked_by = null, updated_at = now()
        WHERE id = ${job.id}`;
      result.sent += 1;
    } catch (error) {
      console.error('[notification-service] FAILED ' + job.event_type + ' -> ' + job.recipient_email + ': ' + error.message);
      const terminal = job.attempts >= maxAttempts;
      const nextAt = new Date(Date.now() + retryDelayMs(job.attempts));
      try {
        await sql`
          UPDATE ${sql(job._schema)}.notification_stream
          SET status = ${terminal ? 'failed' : 'retry'},
              available_at = ${terminal ? job.available_at : nextAt},
              last_error = ${error.message}, locked_at = null, locked_by = null, updated_at = now()
          WHERE id = ${job.id}`;
        if (terminal) result.failed += 1;
        else result.retried += 1;
      } catch (updateError) {
        result.errors.push(job.id + ': ' + updateError.message);
      }
      result.errors.push(job.id + ': ' + error.message);
    }
  }
  return result;
}

export async function retryMessage(id) {
  for (const schema of await outboxSchemas()) {
    const [row] = await sql`
      UPDATE ${sql(schema)}.notification_stream
      SET status = 'queued', attempts = 0, available_at = now(), last_error = null,
          locked_at = null, locked_by = null, updated_at = now()
      WHERE id = ${id} AND status IN ('failed', 'retry')
      RETURNING id, status`;
    if (row) return row;
  }
  throw new Error('Message is not retryable.');
}
