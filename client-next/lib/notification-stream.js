import { supabaseAdmin } from '@/lib/supabase';

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

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('notification_stream')
    .select('dedupe_key')
    .in('dedupe_key', rows.map((row) => row.dedupe_key));

  if (existingError) throw new Error('Could not inspect feedback email queue: ' + existingError.message);

  const existingKeys = new Set((existing || []).map((row) => row.dedupe_key));
  const newRows = rows.filter((row) => !existingKeys.has(row.dedupe_key));

  if (newRows.length) {
    const { error } = await supabaseAdmin
      .from('notification_stream')
      .upsert(newRows, { onConflict: 'dedupe_key', ignoreDuplicates: true });

    if (error) throw new Error('Could not enqueue feedback email: ' + error.message);
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
  const { data, error } = await supabaseAdmin
    .from('notification_stream')
    .update({
      status: 'queued',
      attempts: 0,
      available_at: new Date().toISOString(),
      last_error: null,
      locked_at: null,
      locked_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', messageId)
    .in('status', ['failed', 'retry'])
    .select('id, status')
    .maybeSingle();

  if (error) throw new Error('Could not retry notification: ' + error.message);
  if (!data) throw new Error('Notification is not retryable');
  return data;
}

