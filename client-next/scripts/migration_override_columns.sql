-- Add admin override and penalty columns to attendance_records
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS admin_override BOOLEAN DEFAULT false;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS override_by TEXT DEFAULT NULL;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS penalty BOOLEAN DEFAULT false;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS penalty_reason TEXT DEFAULT NULL;
