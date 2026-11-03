-- Durable notification stream for reliable email delivery.
-- Apply in Supabase SQL Editor before enabling the notification worker.
-- The application uses the "july" schema through its Supabase client.

SET search_path TO july, public;

CREATE TABLE IF NOT EXISTS notification_stream (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email')),
  recipient_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'retry', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ NULL,
  locked_by TEXT NULL,
  sent_at TIMESTAMPTZ NULL,
  provider_message_id TEXT NULL,
  last_error TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notification_stream_available_idx
  ON notification_stream (status, available_at, created_at);

CREATE INDEX IF NOT EXISTS notification_stream_recipient_idx
  ON notification_stream (recipient_email, created_at DESC);

COMMENT ON TABLE notification_stream IS
  'Durable outbox for application messages. Jobs are retried by the notification worker.';

