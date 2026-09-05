import { createClient } from '@supabase/supabase-js';
import { config } from './config.mjs';
import { sendFeedbackAvailableEmail } from '../../client-next/lib/emailer.js';

const db = createClient(config.supabaseUrl, config.serviceRoleKey, {
  db: { schema: config.schema },
  auth: { autoRefreshToken: false, persistSession: false },
});

const maxAttempts = 6;

function retryDelayMs(attempt) {
  return Math.min(30 * 60 * 1000, 60 * 1000 * (2 ** Math.max(0, attempt - 1)));
}

export async function getQueueCounts() {
  const { data, error } = await db
    .from('notification_stream')
    .select('status');

  if (error) throw new Error(error.message);

  return (data || []).reduce((counts, row) => {
    counts[row.status] = (counts[row.status] || 0) + 1;
    return counts;
  }, { queued: 0, processing: 0, retry: 0, sent: 0, failed: 0 });
}

export async function listMessages(limit = 50) {
  const { data, error } = await db
    .from('notification_stream')
    .select('id, event_type, recipient_email, status, attempts, available_at, sent_at, provider_message_id, last_error, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data || [];
}

async function claimAvailableMessages(limit) {
  const now = new Date().toISOString();
  const { data: candidates, error } = await db
    .from('notification_stream')
    .select('*')
    .in('status', ['queued', 'retry'])
    .lte('available_at', now)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);

  const claimed = [];
  for (const candidate of candidates || []) {
    const { data: job, error: claimError } = await db
      .from('notification_stream')
      .update({
        status: 'processing',
        attempts: (candidate.attempts || 0) + 1,
        locked_at: now,
        locked_by: 'notification-service',
        updated_at: now,
      })
      .eq('id', candidate.id)
      .in('status', ['queued', 'retry'])
      .select()
      .maybeSingle();

    if (claimError) {
      console.error('[notification-service] claim failed:', claimError.message);
    } else if (job) {
      claimed.push(job);
    }
  }
  return claimed;
}

export async function drainStream(limit = 20) {
  const result = { claimed: 0, sent: 0, retried: 0, failed: 0, errors: [] };
  const jobs = await claimAvailableMessages(limit);
  result.claimed = jobs.length;

  for (const job of jobs) {
    try {
      if (job.event_type !== 'feedback_available' || job.channel !== 'email') {
        throw new Error('Unsupported event ' + job.event_type + ' over ' + job.channel);
      }

      if (config.sandbox && !config.sandboxRecipients.has(job.recipient_email.toLowerCase())) {
        throw new Error('Sandbox blocked non-test recipient: ' + job.recipient_email);
      }

      const info = await sendFeedbackAvailableEmail(
        job.recipient_email,
        job.recipient_name || 'Student',
        job.payload.session,
        job.payload.deadline,
        { messageId: '<cipd-feedback-' + job.id + '@iiitd.ac.in>' }
      );

      const { error } = await db
        .from('notification_stream')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          provider_message_id: info?.messageId || null,
          last_error: null,
          locked_at: null,
          locked_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      if (error) throw new Error(error.message);
      result.sent += 1;
    } catch (error) {
      const terminal = job.attempts >= maxAttempts;
      const { error: updateError } = await db
        .from('notification_stream')
        .update({
          status: terminal ? 'failed' : 'retry',
          available_at: terminal
            ? job.available_at
            : new Date(Date.now() + retryDelayMs(job.attempts)).toISOString(),
          last_error: error.message,
          locked_at: null,
          locked_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      if (updateError) result.errors.push(job.id + ': ' + updateError.message);
      else if (terminal) result.failed += 1;
      else result.retried += 1;
      result.errors.push(job.id + ': ' + error.message);
    }
  }
  return result;
}

export async function retryMessage(id) {
  const { data, error } = await db
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
    .eq('id', id)
    .in('status', ['failed', 'retry'])
    .select('id, status')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Message is not retryable.');
  return data;
}

