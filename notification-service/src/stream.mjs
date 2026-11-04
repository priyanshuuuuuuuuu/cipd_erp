import { eq, and, inArray, lte, desc, asc, sql } from 'drizzle-orm';
import { config } from './config.mjs';
import {
  notificationStream,
  getSchemaDb,
  getActiveCohortSchema,
  getAllCohortSchemas,
} from './db.mjs';
import {
  sendFeedbackAvailableEmail,
  sendFeedbackReminderEmail,
  sendPasswordResetEmail,
  sendAttendanceSummaryEmail,
  sendWeeklyScheduleEmail,
  sendGeneralNotificationEmail,
  sendDayBeforeReminderEmail,
  sendDailyStudentDigestEmail,
} from './emailer.mjs';

const maxAttempts = 6;

function retryDelayMs(attempt) {
  return Math.min(30 * 60 * 1000, 60 * 1000 * (2 ** Math.max(0, attempt - 1)));
}

/**
 * Returns summary counts of messages by status for the specified schema.
 */
export async function getQueueCounts(schemaName) {
  const schema = schemaName || (await getActiveCohortSchema());
  const { db } = getSchemaDb(schema);

  const rows = await db
    .select({
      status: notificationStream.status,
      count: sql`count(*)`,
    })
    .from(notificationStream)
    .groupBy(notificationStream.status);

  const counts = { queued: 0, processing: 0, retry: 0, sent: 0, failed: 0 };
  for (const r of rows || []) {
    if (r.status in counts) {
      counts[r.status] = Number(r.count || 0);
    }
  }
  return counts;
}

/**
 * Lists the most recent notification messages for the specified schema.
 */
export async function listMessages(limit = 50, schemaName) {
  const schema = schemaName || (await getActiveCohortSchema());
  const { db } = getSchemaDb(schema);

  const rows = await db
    .select({
      id: notificationStream.id,
      event_type: notificationStream.eventType,
      recipient_email: notificationStream.recipientEmail,
      recipient_name: notificationStream.recipientName,
      status: notificationStream.status,
      attempts: notificationStream.attempts,
      available_at: notificationStream.availableAt,
      sent_at: notificationStream.sentAt,
      provider_message_id: notificationStream.providerMessageId,
      last_error: notificationStream.lastError,
      created_at: notificationStream.createdAt,
    })
    .from(notificationStream)
    .orderBy(desc(notificationStream.createdAt))
    .limit(limit);

  return rows || [];
}

/**
 * Claims available messages in queued or retry state for a single schema.
 */
async function claimAvailableMessages(limit, schemaName) {
  const { db } = getSchemaDb(schemaName);
  const now = new Date().toISOString();

  const candidates = await db
    .select()
    .from(notificationStream)
    .where(
      and(
        inArray(notificationStream.status, ['queued', 'retry']),
        lte(notificationStream.availableAt, now)
      )
    )
    .orderBy(asc(notificationStream.createdAt))
    .limit(limit);

  if (!candidates || candidates.length === 0) return [];

  const claimed = [];
  for (const candidate of candidates) {
    try {
      const [job] = await db
        .update(notificationStream)
        .set({
          status: 'processing',
          attempts: (candidate.attempts || 0) + 1,
          lockedAt: now,
          lockedBy: 'notification-service',
          updatedAt: now,
        })
        .where(
          and(
            eq(notificationStream.id, candidate.id),
            inArray(notificationStream.status, ['queued', 'retry'])
          )
        )
        .returning();

      if (job) claimed.push(job);
    } catch (claimErr) {
      console.error(`[notification-service] Claim failed on ${schemaName}:`, claimErr.message);
    }
  }
  return claimed;
}

/**
 * Drains and delivers messages for a single schema.
 */
export async function drainStreamForSchema(schemaName, limit = 20) {
  const result = { schema: schemaName, claimed: 0, sent: 0, retried: 0, failed: 0, errors: [] };
  const jobs = await claimAvailableMessages(limit, schemaName);
  result.claimed = jobs.length;
  if (!jobs.length) return result;

  const { db } = getSchemaDb(schemaName);

  for (const job of jobs) {
    try {
      if (job.channel !== 'email') {
        throw new Error('Unsupported channel ' + job.channel);
      }

      const supportedEvents = [
        'feedback_available',
        'feedback_reminder',
        'password_reset',
        'attendance_summary',
        'weekly_schedule',
        'general_notification',
        'class_reminder',
        'day_before_reminder',
        'daily_digest',
      ];

      if (!supportedEvents.includes(job.eventType)) {
        throw new Error('Unsupported event ' + job.eventType + ' over ' + job.channel);
      }

      if (config.sandbox && !config.sandboxRecipients.has(job.recipientEmail.toLowerCase())) {
        throw new Error('Sandbox blocked non-test recipient: ' + job.recipientEmail);
      }

      let info;
      const payload = job.payload || {};

      switch (job.eventType) {
        case 'feedback_available':
          info = await sendFeedbackAvailableEmail(
            job.recipientEmail,
            job.recipientName || 'Student',
            payload.session,
            payload.deadline,
            { messageId: `<cipd-feedback-${job.id}@iiitd.ac.in>` }
          );
          break;

        case 'password_reset': {
          const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://cipd-erp-ic24.vercel.app').replace(/\/$/, '');
          info = await sendPasswordResetEmail({
            to: job.recipientEmail,
            firstName: job.recipientName || 'Student',
            resetUrl:
              payload.resetUrl ||
              (payload.resetToken
                ? `${appUrl}/reset-password?token=${payload.resetToken}`
                : `${appUrl}/reset-password`),
          });
          break;
        }

        case 'attendance_summary':
          info = await sendAttendanceSummaryEmail(
            job.recipientEmail,
            job.recipientName || 'Student',
            payload.session,
            payload.firstSeenAt
          );
          break;

        case 'weekly_schedule':
          info = await sendWeeklyScheduleEmail(
            job.recipientEmail,
            job.recipientName || 'Student',
            payload.sessions || []
          );
          break;

        case 'general_notification':
          info = await sendGeneralNotificationEmail(
            job.recipientEmail,
            job.recipientName || 'Student',
            payload.title || 'Notification',
            payload.message || '',
            payload.type || 'general'
          );
          break;

        case 'day_before_reminder':
          info = await sendDayBeforeReminderEmail(
            job.recipientEmail,
            job.recipientName || 'Student',
            payload.session
          );
          break;

        case 'daily_digest':
          info = await sendDailyStudentDigestEmail(
            job.recipientEmail,
            job.recipientName || 'Student',
            payload.digest || {}
          );
          break;

        case 'class_reminder':
          info = await sendGeneralNotificationEmail(
            job.recipientEmail,
            job.recipientName || 'Student',
            payload.title || 'Class Reminder',
            payload.message || '',
            'class_reminder'
          );
          break;

        case 'feedback_reminder':
          if (payload.session) {
            info = await sendFeedbackReminderEmail(
              job.recipientEmail,
              job.recipientName || 'Student',
              payload.session,
              payload.hoursLeft || 24
            );
          } else {
            info = await sendGeneralNotificationEmail(
              job.recipientEmail,
              job.recipientName || 'Student',
              payload.title || 'Feedback Reminder',
              payload.message || '',
              'feedback_reminder'
            );
          }
          break;

        default:
          throw new Error('Unhandled event ' + job.eventType);
      }

      await db
        .update(notificationStream)
        .set({
          status: 'sent',
          sentAt: new Date().toISOString(),
          providerMessageId: info?.messageId || null,
          lastError: null,
          lockedAt: null,
          lockedBy: null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(notificationStream.id, job.id));

      result.sent += 1;
    } catch (error) {
      const attempts = job.attempts || 1;
      const terminal = attempts >= maxAttempts;

      await db
        .update(notificationStream)
        .set({
          status: terminal ? 'failed' : 'retry',
          availableAt: terminal
            ? job.availableAt
            : new Date(Date.now() + retryDelayMs(attempts)).toISOString(),
          lastError: error.message,
          lockedAt: null,
          lockedBy: null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(notificationStream.id, job.id));

      if (terminal) result.failed += 1;
      else result.retried += 1;
      result.errors.push(`${job.id}: ${error.message}`);
    }
  }

  return result;
}

/**
 * Drains messages across target schema (or all registered schemas if none specified).
 */
export async function drainStream(limit = 20, targetSchema) {
  if (targetSchema) {
    return await drainStreamForSchema(targetSchema, limit);
  }

  const schemas = await getAllCohortSchemas();
  const summary = { claimed: 0, sent: 0, retried: 0, failed: 0, errors: [] };

  for (const s of schemas) {
    try {
      const res = await drainStreamForSchema(s, limit);
      summary.claimed += res.claimed;
      summary.sent += res.sent;
      summary.retried += res.retried;
      summary.failed += res.failed;
      if (res.errors && res.errors.length) {
        summary.errors.push(...res.errors);
      }
    } catch (err) {
      summary.errors.push(`[${s}] ${err.message}`);
    }
  }

  return summary;
}

/**
 * Resets a failed or retried message back to queued state.
 */
export async function retryMessage(id, schemaName) {
  const schemas = schemaName ? [schemaName] : await getAllCohortSchemas();

  for (const s of schemas) {
    const { db } = getSchemaDb(s);
    const [row] = await db
      .update(notificationStream)
      .set({
        status: 'queued',
        attempts: 0,
        availableAt: new Date().toISOString(),
        lastError: null,
        lockedAt: null,
        lockedBy: null,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(notificationStream.id, id),
          inArray(notificationStream.status, ['failed', 'retry'])
        )
      )
      .returning({ id: notificationStream.id, status: notificationStream.status });

    if (row) return { ...row, schema: s };
  }

  throw new Error('Message not found or not in retryable status.');
}
