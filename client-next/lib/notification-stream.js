import { db } from '@/lib/db';
import { users, notificationStream } from '@/drizzle/schema';
import { eq, and, inArray } from 'drizzle-orm';

const DEFAULT_SANDBOX_RECIPIENTS = [
  'priyanshupandey18112005@gmail.com',
  'p18nov2005@gmail.com',
  'parsh23368@iiitd.ac.in',
  'mayank23315@iiitd.ac.in',
  'parshjain.j@gmail.com',
  'parshslox@gmail.com',
  'chuhanmayank865@gmail.com',
  'aaman23006@iiitd.ac.in',
  'aamanprime@gmail.com',
  'karan23271@iiitd.ac.in',
  'aamanprime.1@gmail.com',
  'aamanprime.2@gmail.com',
  'aamanprime.3@gmail.com',
  'aamanprime.4@gmail.com',
];

function configuredSandboxRecipients() {
  const configured = (process.env.NOTIFICATION_SANDBOX_RECIPIENTS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(configured.length ? configured : DEFAULT_SANDBOX_RECIPIENTS)];
}

export function isNotificationSandboxEnabled() {
  return process.env.NOTIFICATION_SANDBOX_MODE === 'true';
}

export function notificationSandboxRecipients() {
  return configuredSandboxRecipients();
}

/**
 * The Next.js application is an outbox producer only. SMTP delivery, retries,
 * and state transitions are owned by notification-service.
 */
export async function enqueueFeedbackMessages(session, deadline, students = []) {
  const sandbox = isNotificationSandboxEnabled();
  const recipients = sandbox
    ? configuredSandboxRecipients().map((email) => ({
      email,
      name: 'CiPD feedback tester',
      userId: null,
    }))
    : students.map((student) => ({
      email: student.email?.trim().toLowerCase(),
      name: ((student.first_name || '') + ' ' + (student.last_name || '')).trim() || 'Student',
      userId: student.id,
    })).filter((student) => student.email);

  if (!recipients.length) return { queued: 0, sandbox, recipients: [] };

  const rows = recipients.map((recipient) => ({
    session_id: session.id,
    dedupe_key: 'feedback_available:' + session.id + ':' + recipient.email,
    event_type: 'feedback_available',
    channel: 'email',
    recipient_id: recipient.userId,
    recipient_email: recipient.email,
    recipient_name: recipient.name,
    payload: { session, deadline, sandbox },
    status: 'queued',
    available_at: new Date().toISOString(),
  }));

  const dedupeKeys = rows.map((row) => row.dedupe_key);
  const existing = await db
    .select({ dedupeKey: notificationStream.dedupeKey })
    .from(notificationStream)
    .where(inArray(notificationStream.dedupeKey, dedupeKeys));

  const existingKeys = new Set((existing || []).map((row) => row.dedupeKey));
  const newRows = rows.filter((row) => !existingKeys.has(row.dedupe_key));

  if (newRows.length) {
    const insertRows = newRows.map((r) => ({
      sessionId: r.session_id,
      dedupeKey: r.dedupe_key,
      eventType: r.event_type,
      channel: r.channel,
      recipientId: r.recipient_id,
      recipientEmail: r.recipient_email,
      recipientName: r.recipient_name,
      payload: r.payload,
      status: r.status,
      availableAt: r.available_at,
    }));

    await db
      .insert(notificationStream)
      .values(insertRows)
      .onConflictDoNothing({ target: notificationStream.dedupeKey });
  }

  return {
    queued: newRows.length,
    alreadyQueued: rows.length - newRows.length,
    total: rows.length,
    sandbox,
    recipients: rows.map((row) => row.recipient_email),
  };
}

export async function retryNotificationMessage(messageId) {
  const [data] = await db
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
        eq(notificationStream.id, messageId),
        inArray(notificationStream.status, ['failed', 'retry'])
      )
    )
    .returning({ id: notificationStream.id, status: notificationStream.status });

  if (!data) throw new Error('Notification is not retryable');
  return data;
}

/**
 * Enqueues a password-reset email via the notification stream outbox.
 * The notification service resolves APP_URL from its own environment,
 * so the reset link is always the production URL — never localhost.
 *
 * @param {{ studentId: string, email: string, firstName: string, resetToken: string }} opts
 */
export async function enqueuePasswordResetEmail({ studentId, email, firstName, resetToken }) {
  const dedupeKey = 'password_reset:' + studentId + ':' + resetToken.slice(-16);

  await db
    .insert(notificationStream)
    .values({
      dedupeKey,
      eventType: 'password_reset',
      channel: 'email',
      recipientId: studentId || null,
      recipientEmail: email.trim().toLowerCase(),
      recipientName: firstName || null,
      payload: { resetToken },
      status: 'queued',
      availableAt: new Date().toISOString(),
    })
    .onConflictDoNothing({ target: notificationStream.dedupeKey });

  return { queued: 1 };
}

/**
 * Enqueues attendance summary emails via the notification stream outbox.
 * @param {object} session
 * @param {Array} records - the attendance records with student_id and first_seen_at
 */
export async function enqueueAttendanceSummaryMessages(session, records = []) {
  if (!records.length) return { queued: 0 };
  
  // Filter records to those who are present or seen at least once
  const presentRecords = records.filter(r => r.status === 'present' || r.status === 'partial' || r.ping_count > 0 || r.first_seen_at != null);
  if (!presentRecords.length) return { queued: 0 };
  
  const studentIds = presentRecords.map(r => r.student_id);
  
  const students = await db
    .select({
      id: users.id,
      first_name: users.firstName,
      last_name: users.lastName,
      email: users.email,
    })
    .from(users)
    .where(and(inArray(users.id, studentIds), eq(users.isActive, true)));
  
  const sandbox = isNotificationSandboxEnabled();
  
  const recipients = sandbox
    ? configuredSandboxRecipients().map((email) => ({
      email,
      name: 'CiPD Tester',
      userId: null,
      record: presentRecords[0] // just use first record for sandbox
    }))
    : (students || []).map((student) => ({
      email: student.email?.trim().toLowerCase(),
      name: ((student.first_name || '') + ' ' + (student.last_name || '')).trim() || 'Student',
      userId: student.id,
      record: presentRecords.find(r => r.student_id === student.id)
    })).filter((r) => r.email && r.record);

  if (!recipients.length) return { queued: 0, sandbox, recipients: [] };

  const rows = recipients.map((recipient) => ({
    session_id: session.id,
    dedupe_key: 'attendance_summary:' + session.id + ':' + recipient.email,
    event_type: 'attendance_summary',
    channel: 'email',
    recipient_id: recipient.userId,
    recipient_email: recipient.email,
    recipient_name: recipient.name,
    payload: { session, firstSeenAt: recipient.record.first_seen_at },
    status: 'queued',
    available_at: new Date().toISOString(),
  }));

  const dedupeKeys = rows.map((row) => row.dedupe_key);
  const existing = await db
    .select({ dedupeKey: notificationStream.dedupeKey })
    .from(notificationStream)
    .where(inArray(notificationStream.dedupeKey, dedupeKeys));

  const existingKeys = new Set((existing || []).map((row) => row.dedupeKey));
  const newRows = rows.filter((row) => !existingKeys.has(row.dedupe_key));

  if (newRows.length) {
    const insertRows = newRows.map((r) => ({
      sessionId: r.session_id,
      dedupeKey: r.dedupe_key,
      eventType: r.event_type,
      channel: r.channel,
      recipientId: r.recipient_id,
      recipientEmail: r.recipient_email,
      recipientName: r.recipient_name,
      payload: r.payload,
      status: r.status,
      availableAt: r.available_at,
    }));

    await db
      .insert(notificationStream)
      .values(insertRows)
      .onConflictDoNothing({ target: notificationStream.dedupeKey });
  }

  return {
    queued: newRows.length,
    alreadyQueued: rows.length - newRows.length,
    total: rows.length,
    sandbox,
    recipients: rows.map((row) => row.recipient_email),
  };
}
