-- Link durable notification jobs to sessions so the admin schedule can show
-- live queued/sending/sent progress. Apply this after migration_notification_stream.sql.
SET search_path TO july, public;

ALTER TABLE notification_stream
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES sessions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS notification_stream_session_idx
  ON notification_stream(session_id, created_at DESC);

-- Preserve visibility for jobs created before the session_id column existed.
UPDATE notification_stream
SET session_id = (payload->'session'->>'id')::UUID
WHERE session_id IS NULL
  AND payload->'session'->>'id' IS NOT NULL;