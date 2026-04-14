-- ================================================
-- Migration: Attendance Records Enhancements
-- ================================================
-- Existing tables used:
--   wifi_snapshots (id, captured_at TIMESTAMPTZ, iw_dump JSONB, error)
--   wifi_clients (mac_address VARCHAR, signal_level INT, status VARCHAR, updated_at)
--   system_settings (ping_interval, pings_per_session, presence_threshold, attendance_window)
-- ================================================

BEGIN;

ALTER TABLE attendance_records 
    ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS duration_minutes NUMERIC(6,1) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS avg_signal_strength NUMERIC(6,1);

COMMIT;
